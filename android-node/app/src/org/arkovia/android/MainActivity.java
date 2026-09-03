package org.arkovia.android;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.json.JSONObject;

public final class MainActivity extends Activity {
 private TextView status,metrics,log;
 private EditText peers;
 private Switch wifi,charging;
 private Button start,stop;
 private final Handler timer=new Handler(Looper.getMainLooper());
 private final Runnable refresh=new Runnable(){public void run(){renderStatus();timer.postDelayed(this,3000);}};
 private LinearLayout body;
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);
  body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(22),dp(22),dp(22),dp(26));scroll.addView(body);
  scroll.setOnApplyWindowInsetsListener((view,insets)->{body.setPadding(dp(22),dp(22)+insets.getSystemWindowInsetTop(),dp(22),dp(26)+insets.getSystemWindowInsetBottom());return insets;});
  setContentView(scroll);
  label("ARKOVIA  /  ANDROID",13,0xff087f8c,true);
  label("Your world.\nYour node.",32,0xff12304a,true);
  label("Standalone full node • 0.1.0 test build",14,0xff526777,false);
  label("Keep Arkovia running from your phone. Java and the node are included. Initial synchronization may take time and use significant data, storage and battery.",15,0xff526777,false);
  LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setPadding(dp(18),dp(18),dp(18),dp(18));
  GradientDrawable bg=new GradientDrawable();bg.setColor(Color.WHITE);bg.setCornerRadius(dp(18));card.setBackground(bg);
  LinearLayout.LayoutParams cardParams=new LinearLayout.LayoutParams(-1,-2);cardParams.setMargins(0,dp(18),0,dp(16));body.addView(card,cardParams);
  status=text("Stopped",20,0xff12304a,true);card.addView(status);
  metrics=text("Block height —   •   Peers —",16,0xff526777,false);card.addView(metrics);
  start=button("Start node");stop=button("Stop node");
  start.setOnClickListener(v->startNode());stop.setOnClickListener(v->{startService(new Intent(this,NodeService.class).setAction("STOP"));stop.setEnabled(false);});
  label("Connection settings",19,0xff12304a,true);
  label("Seed peers (host:port, separated by semicolons)",13,0xff526777,false);
  peers=new EditText(this);peers.setText(NodeFiles.prefs(this).getString("peers",NodeFiles.DEFAULT_PEERS));peers.setTextSize(14);peers.setSingleLine(false);peers.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);body.addView(peers);
  wifi=new Switch(this);wifi.setText("Wi-Fi only");wifi.setChecked(NodeFiles.prefs(this).getBoolean("wifi",true));body.addView(wifi);
  charging=new Switch(this);charging.setText("Run only while charging");charging.setChecked(NodeFiles.prefs(this).getBoolean("charging",false));body.addView(charging);
  label("If a selected condition stops being met, the node stops. Start it again when ready. The node does not start automatically after a reboot.",13,0xff526777,false);
  label("This test build verifies and stores the chain. It does not request wallet secrets or enable forging. Phone and network testing is still required.",13,0xff526777,false);
  button("View build & license information").setOnClickListener(v->{try{new AlertDialog.Builder(this).setTitle("About this test build").setMessage(NodeFiles.assetText(this,"BUILD-INFO.txt")).setPositiveButton("Close",null).show();}catch(Exception e){error(e);}});
  label("Node log",19,0xff12304a,true);
  log=label("No node log yet.",11,0xff354a5c,false);log.setTypeface(Typeface.MONOSPACE);log.setTextIsSelectable(true);
  button("Save diagnostic log").setOnClickListener(v->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/plain").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"Arkovia-Node-diagnostics.txt");startActivityForResult(i,20);});
 }
 private TextView text(String s,int size,int color,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(color);t.setPadding(0,dp(5),0,dp(5));if(bold)t.setTypeface(null,Typeface.BOLD);return t;}
 private TextView label(String s,int size,int color,boolean bold){TextView t=text(s,size,color,bold);body.addView(t);return t;}
 private Button button(String title){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setMinHeight(dp(50));body.addView(b,new LinearLayout.LayoutParams(-1,-2));return b;}
 private void startNode(){
  try{
   String seeds=NodeFiles.peers(peers.getText().toString());
   NodeFiles.prefs(this).edit().putString("peers",seeds).putBoolean("wifi",wifi.isChecked()).putBoolean("charging",charging.isChecked()).apply();
   String problem=NodeService.policyProblem(this);if(problem!=null)throw new IOException(problem);
   if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},10);
   startForegroundService(new Intent(this,NodeService.class));start.setEnabled(false);status.setText("Starting…");
  }catch(Exception e){error(e);}
 }
 private void renderStatus(){
  boolean active=NodeService.active;start.setEnabled(!active);stop.setEnabled(active);peers.setEnabled(!active);wifi.setEnabled(!active);charging.setEnabled(!active);
  status.setText(NodeService.message);metrics.setText("Block height —   •   Peers —");
  if(active){try{
   JSONObject s=new JSONObject(NodeFiles.read(new File(NodeFiles.root(this),"status.json")));
   if(System.currentTimeMillis()-s.optLong("updatedAt")<15000&&s.optString("state").equals("running")){
    int count=s.optInt("peers");String state=s.optBoolean("scanning")?"Checking stored blocks":s.optBoolean("downloading")?"Synchronizing":count==0?"Waiting for peers":"Node running";
    status.setText(state);metrics.setText(String.format(Locale.US,"Block %,d   •   %d connected peers",s.optLong("height"),count));
   }
  }catch(Exception ignored){}}
  log.setText(NodeFiles.tail(this));
 }
 private void error(Exception e){new AlertDialog.Builder(this).setTitle("Arkovia Node").setMessage(e.getMessage()).setPositiveButton("OK",null).show();}
 @Override protected void onResume(){super.onResume();timer.post(refresh);}
 @Override protected void onPause(){timer.removeCallbacks(refresh);super.onPause();}
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);if(request!=20||result!=RESULT_OK||data==null||data.getData()==null)return;
  try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
   if(out==null)throw new IOException("Cannot open the selected file.");
   String diagnostic="Arkovia Node 0.1.0 test\nAndroid "+Build.VERSION.RELEASE+" • "+Build.MANUFACTURER+" "+Build.MODEL+"\n"+NodeService.message+"\n\n"+NodeFiles.tail(this);
   out.write(diagnostic.getBytes(StandardCharsets.UTF_8));Toast.makeText(this,"Diagnostic log saved",Toast.LENGTH_SHORT).show();
  }catch(Exception e){error(e);}
 }
}
