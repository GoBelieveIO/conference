//
//  Participant.h
//  contact
//
//  Created by houxh on 2018/8/12.
//  Copyright © 2018年 momo. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <WebRTC/WebRTC.h>
@class Participant;
@class WebRTCVideoView;

typedef void (^OfferBlock)(Participant *p, RTCSessionDescription *sdp);
typedef void (^IceCandicateBlock)(Participant *p, RTCIceCandidate *ice);

@interface Participant : NSObject<RTCPeerConnectionDelegate>
@property(nonatomic, assign) BOOL local;//sendonly

@property(nonatomic, assign) int64_t uid;
@property(nonatomic, copy) NSString *name;
@property(nonatomic, strong) RTCPeerConnection *peerConnection;

@property(nonatomic, strong) RTCVideoTrack *videoTrack;
@property(nonatomic, strong) RTCAudioTrack *audioTrack;

@property(nonatomic, strong) WebRTCVideoView *videoView;
//@property(nonatomic, weak) RTCCameraPreviewView *localVideoView;

@property(nonatomic, copy) OfferBlock offerCB;
@property(nonatomic, copy) IceCandicateBlock iceCB;

-(void)createPeerConnection:(RTCPeerConnectionFactory*)factory;
-(void)createRemotePeerConnection:(RTCPeerConnectionFactory*)factory;
-(void)dispose;
@end
