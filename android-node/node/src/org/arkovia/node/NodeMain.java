package org.arkovia.node;
import nxt.Nxt;
import nxt.peer.Peer;
import nxt.peer.Peers;
import org.json.simple.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
/** Adapter only: uses the repository node and preserves consensus. */
public final class NodeMain {
 private static final AtomicBoolean stopping=new AtomicBoolean();
 private static volatile boolean initialized;
 private static final ScheduledExecutorService monitor=Executors.newSingleThreadScheduledExecutor();
 public static void main(String[] args)throws Exception{
  Runtime.getRuntime().addShutdownHook(new Thread(NodeMain::shutdown,"arkovia-shutdown"));
  writeStatus("starting");
  try{
   Nxt.init();initialized=true;
   monitor.scheduleWithFixedDelay(()->{try{writeStatus("running");}catch(Exception e){e.printStackTrace();}},0,3,TimeUnit.SECONDS);
   BufferedReader in=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
   String line;while((line=in.readLine())!=null)if(line.equals("STOP"))break;
  }finally{shutdown();}
 }
 private static void shutdown(){
  if(!stopping.compareAndSet(false,true))return;
  monitor.shutdownNow();
  try{writeStatus("stopping");if(initialized)Nxt.shutdown();}catch(Throwable e){e.printStackTrace();}
  finally{try{writeStatus("stopped");}catch(Exception e){e.printStackTrace();}}
 }
 @SuppressWarnings("unchecked") private static synchronized void writeStatus(String state)throws Exception{
  JSONObject s=new JSONObject();s.put("state",state);s.put("updatedAt",System.currentTimeMillis());
  if(initialized&&state.equals("running")){
   s.put("height",Nxt.getBlockchain().getHeight());
   s.put("peers",Peers.getAllPeers().stream().filter(p->p.getState()==Peer.State.CONNECTED).count());
   s.put("downloading",Nxt.getBlockchainProcessor().isDownloading());
   s.put("scanning",Nxt.getBlockchainProcessor().isScanning());
   s.put("feederHeight",Nxt.getBlockchainProcessor().getLastBlockchainFeederHeight());
  }
  Path temp=Paths.get("status.json.tmp");Files.write(temp,s.toJSONString().getBytes(StandardCharsets.UTF_8));
  Files.move(temp,Paths.get("status.json"),StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);
 }
}
