/* New Android launcher: MIT. Upstream runtimes retain their own licenses. */
#include <jni.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <sys/prctl.h>
#include <unistd.h>
int main(int argc, char **argv) {
 setvbuf(stdout,NULL,_IONBF,0); setvbuf(stderr,NULL,_IONBF,0);
 if(argc<4) return 64;
 pid_t parent=getppid();
 if(prctl(PR_SET_PDEATHSIG,SIGTERM)!=0 || parent==1 || getppid()!=parent) return 70;
 char path[4096]; snprintf(path,sizeof(path),"%s/libjvm.so",argv[2]);
 void *handle=dlopen(path,RTLD_NOW|RTLD_GLOBAL);
 if(!handle){fprintf(stderr,"Cannot load Java: %s\n",dlerror());return 71;}
 jint (*create)(JavaVM**,void**,void*)=dlsym(handle,"JNI_CreateJavaVM");
 if(!create)return 72;
 int count=argc-3; JavaVMOption *options=calloc(count,sizeof(JavaVMOption));
 if(!options)return 73;
 for(int i=0;i<count;i++)options[i].optionString=argv[i+3];
 JavaVMInitArgs args={.version=JNI_VERSION_1_8,.nOptions=count,.options=options,.ignoreUnrecognized=JNI_FALSE};
 JavaVM *vm=NULL; JNIEnv *env=NULL;
 jint result=create(&vm,(void**)&env,&args);free(options);
 if(result!=JNI_OK){fprintf(stderr,"Java initialization failed: %d\n",result);return 74;}
 jclass cls=(*env)->FindClass(env,"org/arkovia/node/NodeMain");if(!cls)goto error;
 jmethodID method=(*env)->GetStaticMethodID(env,cls,"main","([Ljava/lang/String;)V");if(!method)goto error;
 jclass str=(*env)->FindClass(env,"java/lang/String");if(!str)goto error;
 jobjectArray empty=(*env)->NewObjectArray(env,0,str,NULL);
 (*env)->CallStaticVoidMethod(env,cls,method,empty);
 if((*env)->ExceptionCheck(env))goto error;
 (*vm)->DestroyJavaVM(vm);return 0;
 error: (*env)->ExceptionDescribe(env);return 75;
}
