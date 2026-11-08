#include <initializer_list>
#include <cstdio>
int main(){for(int d:{-1,1}){float x=85,y=100,vy=d*3.f,shadow=157;for(int n=1;n<=100;n++){x+=3.33f;y+=vy;vy*=.97f;shadow+=vy;if(n==1||n==10||n==34||n==60||n==100)printf("%d %d %.9g %.9g %.9g %.9g\n",d,n,x,y,vy,shadow);}}}
