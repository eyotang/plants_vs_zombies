// Independent Reanimation::Update arithmetic for the40-pose eating clip.
#include <cstdio>
#include <initializer_list>
int main(){const double dt=.01f;bool comma=false;printf("[");for(float rate:{18.f,36.f}){float time=0;for(int n=1;n<=100000;n++){time+=dt*rate/40;while(time>=1)time-=1;if(n==1||n==17||n==100||n==1000||n==10000||n==100000){printf("%s{\"rate\":%.0f,\"tick\":%d,\"time\":%.17g}",comma?",":"",rate,n,time);comma=true;}}}printf("]\n");}
