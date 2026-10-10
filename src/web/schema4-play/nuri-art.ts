/** Source PR43 3c3ec3d v05. No candidate viewer/choreography is executed. */
export const frames={
 idle:{rect:[16,130,390,616],pivot:[182.25,613]},
 preparation:{rect:[446,131,809,616],pivot:[598.75,613]},
 release:{rect:[831,131,1361,616],pivot:[1056,613]},
 recoil:{rect:[1386,130,1746,616],pivot:[1536.25,613]},
 recovery:{rect:[1790,132,2152,617],pivot:[1949.25,614]},
} as const;
export const commonHeight=480,releaseRim={x:1348-1056,y:443-613};
export const paths={body:'nuri-direction-correction-raw-v05.png',bubble:'flight-bubble-raw-v05.png',impact:'water-impact-reference-v04.png',ripple:'ground-ripple-reference-v04.png'};
export const bubble={width:1254,height:1254,visibleWidth:793,pivot:{x:(218+1011)/2,y:(271+1025)/2}};
