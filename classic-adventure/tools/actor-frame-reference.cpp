// Pinned Reanimator.cpp GetFrameTime, GetTransformAtTime and BlendTransform.
#include <cmath>
#include <cstdio>
#include <initializer_list>
int main(){bool comma=false;printf("[\n");for(int start:{44,91,138}){int count=start==138?40:47;float time=0;const double dt=.01f;for(int n=1;n<=100000;n++){time+=dt*(start==138?36.f:13.298193f)/count;while(time>=1.f)time-=1.f;if(n==1||n==17||n==100||n==1000||n==10000||n==100000){float position=start+time*(count-1),before=floor(position),fraction=position-before;int frame=(int)before-start,next=frame>=count-1?count-1:frame+1;frame=frame>=count-1?count-1:frame;float a=12.34567f+frame*.12345f,b=12.34567f+next*.12345f,pose=a+fraction*(b-a);printf("%s{\"start\":%d,\"count\":%d,\"tick\":%d,\"time\":%.17g,\"frame\":%d,\"next\":%d,\"fraction\":%.17g,\"a\":%.17g,\"b\":%.17g,\"pose\":%.17g}",comma?",\n":"",start,count,n,(double)time,frame,next,(double)fraction,(double)a,(double)b,(double)pose);comma=true;}}}printf("\n]\n");}
