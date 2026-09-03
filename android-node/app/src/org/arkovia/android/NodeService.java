package org.arkovia.android;
import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.net.*;
import android.os.*;
import java.lang.Process;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.arkovia.node.android.R;

public final class NodeService extends Service {
 public static volatile boolean active;
 public static volatile String message="Stopped";
 private volatile boolean cancelled;
 private volatile Process process;
 private PowerManager.WakeLock wake;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable policyCheck=new Runnable(){public void run(){
  if(!active||cancelled)return;
  String problem=policyProblem(NodeService.this);
  if(problem!=null){message=problem;requestStop();}else handler.postDelayed(this,5000);
 }};
 public static String policyProblem(Context c){
  ConnectivityManager manager=c.getSystemService(ConnectivityManager.class);
  NetworkCapabilities cap=manager.getNetworkCapabilities(manager.getActiveNetwork());
  if(cap==null||!cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))return "No network connection. Start again when connected.";
  if(NodeFiles.prefs(c).getBoolean("wifi",true)&&!cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))return "Wi-Fi required. Connect to Wi-Fi and start again.";
  if(NodeFiles.prefs(c).getBoolean("charging",false)){
   Intent battery=c.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
   if(battery==null||battery.getIntExtra(BatteryManager.EXTRA_PLUGGED,0)==0)return "Charging required. Plug in and start again.";
  }
  if(new StatFs(c.getFilesDir().getPath()).getAvailableBytes()<256L*1024*1024)return "Storage is nearly full. Free space before restarting.";
  return null;
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent!=null&&"STOP".equals(intent.getAction())){requestStop();return START_NOT_STICKY;}
  if(active)return START_NOT_STICKY;
  NotificationManager nm=getSystemService(NotificationManager.class);
  nm.createNotificationChannel(new NotificationChannel("node","Arkovia node",NotificationManager.IMPORTANCE_LOW));
  Intent open=new Intent(this,MainActivity.class);
  PendingIntent show=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,NodeService.class).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification n=new Notification.Builder(this,"node").setSmallIcon(R.drawable.ic_node).setContentTitle("Arkovia Node")
   .setContentText("Node session active • tap for status").setContentIntent(show).setOngoing(true)
   .addAction(new Notification.Action.Builder(null,"Stop node",stop).build()).build();
  if(Build.VERSION.SDK_INT>=34)startForeground(1,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1,n);
  active=true;cancelled=false;message="Preparing bundled node…";
  wake=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"arkovia:node");wake.acquire();
  handler.postDelayed(policyCheck,5000);
  new Thread(this::runNode,"arkovia-supervisor").start();return START_NOT_STICKY;
 }
 private void runNode(){
  try{
   String problem=policyProblem(this);if(problem!=null)throw new IOException(problem);
   if(android.system.Os.sysconf(android.system.OsConstants._SC_PAGESIZE)!=4096)throw new IOException("This test runtime needs a device with 4 KB memory pages.");
   NodeFiles.prepare(this);if(cancelled)return;
   File log=new File(NodeFiles.root(this),"node.log");
   if(log.isFile())java.nio.file.Files.move(log.toPath(),new File(NodeFiles.root(this),"previous-node.log").toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
   ProcessBuilder pb=new ProcessBuilder(NodeFiles.command(this));pb.directory(NodeFiles.root(this));pb.redirectErrorStream(true);
   String libs=getApplicationInfo().nativeLibraryDir;
   pb.environment().put("LD_LIBRARY_PATH",libs);pb.environment().put("JAVA_HOME",new File(NodeFiles.root(this),"jre").getPath());
   pb.environment().put("TMPDIR",new File(NodeFiles.root(this),"tmp").getPath());
   synchronized(this){if(cancelled)return;process=pb.start();}
   message="Starting Java and loading blockchain…";
   try(InputStream in=process.getInputStream();RandomAccessFile out=new RandomAccessFile(log,"rw")){
    byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){
     if(out.length()>2*1024*1024){out.setLength(0);out.seek(0);}
     out.write(b,0,n);
    }
   }
   int code=process.waitFor();if(!cancelled)message="Node exited (code "+code+"). See log.";
  }catch(Exception e){message="Cannot start node: "+e.getMessage();}
  finally{handler.post(()->{active=false;stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();});}
 }
 private synchronized void requestStop(){
  if(cancelled)return;cancelled=true;
  if(!message.contains("required")&&!message.contains("network")&&!message.contains("Storage"))message="Stopping safely…";
  Process p=process;
  if(p!=null)new Thread(()->{
   try{p.getOutputStream().write("STOP\n".getBytes(StandardCharsets.UTF_8));p.getOutputStream().flush();
    if(!p.waitFor(30,TimeUnit.SECONDS)){p.destroy();if(!p.waitFor(15,TimeUnit.SECONDS))p.destroyForcibly();}
   }catch(Exception e){p.destroy();}
  },"arkovia-stop").start();
  else if(!active)stopSelf();
 }
 @Override public void onDestroy(){
  handler.removeCallbacks(policyCheck);Process p=process;if(p!=null&&p.isAlive())p.destroy();
  if(wake!=null&&wake.isHeld())wake.release();active=false;
  if(message.startsWith("Stopping"))message="Stopped";
  super.onDestroy();
 }
 @Override public IBinder onBind(Intent intent){return null;}
}
