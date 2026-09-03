package org.arkovia.android;
import android.content.*;
import android.system.Os;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;
import org.json.*;

final class NodeFiles {
 static final String DEFAULT_PEERS="147.93.138.255:4874;217.216.64.226:4874";
 static File root(Context c){return new File(c.getFilesDir(),"node");}
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("node-settings",0);}
 static String peers(String input){
  String value=input.trim();if(value.isEmpty()||value.length()>1024)throw new IllegalArgumentException("Enter one or more seed peers.");
  for(String peer:value.split(";",-1)){
   if(!peer.matches("[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?:[0-9]{1,5}"))throw new IllegalArgumentException("Use host:port;host:port with no spaces.");
   int port=Integer.parseInt(peer.substring(peer.lastIndexOf(':')+1));
   if(port<1||port>65535)throw new IllegalArgumentException("Peer ports must be 1–65535.");
  }
  return value;
 }
 static void prepare(Context c)throws Exception{
  File root=root(c);root.mkdirs();new File(root,"logs").mkdirs();
  String expected=assetText(c,"payload.sha256").trim();
  File marker=new File(root,".payload-version");
  if(!marker.isFile()||!read(marker).trim().equals(expected)){
   MessageDigest hash=MessageDigest.getInstance("SHA-256");
   try(InputStream in=c.getAssets().open("payload.zip")){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)hash.update(b,0,n);}
   StringBuilder actual=new StringBuilder();for(byte b:hash.digest())actual.append(String.format(Locale.ROOT,"%02x",b&255));
   if(!expected.equals(actual.toString()))throw new IOException("Bundled node integrity check failed.");
   try(ZipInputStream z=new ZipInputStream(c.getAssets().open("payload.zip"))){
    ZipEntry e;byte[] b=new byte[65536];while((e=z.getNextEntry())!=null){
     File dest=new File(root,e.getName());
     if(!dest.getCanonicalPath().startsWith(root.getCanonicalPath()+File.separator))throw new IOException("Invalid bundle path.");
     if(e.isDirectory()){dest.mkdirs();continue;}dest.getParentFile().mkdirs();
     try(OutputStream out=new FileOutputStream(dest)){int n;while((n=z.read(b))!=-1)out.write(b,0,n);}
    }
   }
   write(marker,expected);
  }
  JSONArray links=new JSONArray(assetText(c,"runtime-libraries.json"));
  for(int i=0;i<links.length();i++){
   JSONObject entry=links.getJSONObject(i);File dest=new File(root,entry.getString("path"));dest.getParentFile().mkdirs();
   Files.deleteIfExists(dest.toPath());
   Os.symlink(new File(c.getApplicationInfo().nativeLibraryDir,entry.getString("library")).getPath(),dest.getPath());
  }
  new File(root,"tmp").mkdirs();
  Files.deleteIfExists(new File(root,"status.json").toPath());
  Properties p=new Properties();
  p.setProperty("nxt.isTestnet","false");p.setProperty("nxt.isLightClient","false");
  p.setProperty("nxt.wellKnownPeers",peers(prefs(c).getString("peers",DEFAULT_PEERS)));
  p.setProperty("nxt.peerServerPort","4874");p.setProperty("nxt.shareMyAddress","false");
  p.setProperty("nxt.enableAPIServer","false");p.setProperty("nxt.enableAPIProxy","false");
  p.setProperty("nxt.enablePeerServerUPnP","false");p.setProperty("nxt.enableAPIUPnP","false");
  p.setProperty("nxt.launchDesktopApplication","false");p.setProperty("nxt.addOns","");
  p.setProperty("nxt.maxNumberOfOutboundConnections","8");p.setProperty("nxt.maxNumberOfConnectedPublicPeers","8");
  p.setProperty("nxt.dbCacheKB","32768");p.setProperty("nxt.dbMaxMemoryRows","10000");
  p.setProperty("nxt.dbDir","./nxt_db/nxt");p.setProperty("nxt.includeExpiredPrunable","false");
  try(OutputStream out=new FileOutputStream(new File(root,"conf/nxt.properties"))){p.store(out,"Arkovia Android node — local settings");}
 }
 static List<String> command(Context c){
  File root=root(c);String home=new File(root,"jre").getPath(),nativeDir=c.getApplicationInfo().nativeLibraryDir;
  List<String> a=new ArrayList<>();a.add(nativeDir+"/libarkovia_exec.so");a.add(home);a.add(nativeDir);
  Collections.addAll(a,"-Xms64m","-Xmx512m","-XX:ActiveProcessorCount=2","-Djava.home="+home,
   "-Djava.library.path="+nativeDir,"-Dsun.boot.library.path="+nativeDir,
   "-Djava.io.tmpdir="+new File(root,"tmp"),"-Duser.home="+root,"-Djava.awt.headless=true",
   "-Dnxt.runtime.dirProvider=nxt.env.DefaultDirProvider","-Dfile.encoding=UTF-8",
   "-XX:ErrorFile="+new File(root,"jvm-error.log"));
  StringBuilder cp=new StringBuilder(new File(root,"conf").getPath());
  File[] jars=new File(root,"lib").listFiles((d,n)->n.endsWith(".jar"));
  if(jars!=null){Arrays.sort(jars);for(File f:jars)cp.append(':').append(f.getPath());}
  a.add("-Djava.class.path="+cp);return a;
 }
 static String assetText(Context c,String name)throws IOException{try(InputStream in=c.getAssets().open(name)){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);}}
 static String read(File f)throws IOException{return new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8);}
 static void write(File f,String s)throws IOException{Files.write(f.toPath(),s.getBytes(StandardCharsets.UTF_8));}
 static String tail(Context c){
  File f=new File(root(c),"node.log");if(!f.isFile())return "No node log yet.";
  try(RandomAccessFile in=new RandomAccessFile(f,"r")){int size=(int)Math.min(in.length(),10000);in.seek(in.length()-size);byte[] b=new byte[size];in.readFully(b);return new String(b,StandardCharsets.UTF_8);}catch(IOException e){return e.toString();}
 }
}
