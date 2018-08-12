//
//  Participant.m
//  contact
//
//  Created by houxh on 2018/8/12.
//  Copyright © 2018年 momo. All rights reserved.
//

#import "Participant.h"
#import "WebRTCVideoView.h"

static NSString * const kARDMediaStreamId = @"ARDAMS";
static NSString * const kARDAudioTrackId = @"ARDAMSa0";
static NSString * const kARDVideoTrackId = @"ARDAMSv0";

@implementation Participant



-(void)createRemotePeerConnection:(RTCPeerConnectionFactory*)factory {
    RTCMediaConstraints *constraints = [self defaultPeerConnectionConstraints];
    RTCConfiguration *config = [[RTCConfiguration alloc] init];
    RTCPeerConnection *peerConnection = [factory peerConnectionWithConfiguration:config
                                                                     constraints:constraints
                                                                        delegate:self];
    
    __weak Participant *wself = self;
    [peerConnection offerForConstraints:[self recvOnlyOfferConstraints]
                      completionHandler:^(RTCSessionDescription *sdp,
                                          NSError *error) {
                          [wself.peerConnection setLocalDescription:sdp
                                                  completionHandler:^(NSError *error) {
                                                      if (error != nil) {
                                                          NSLog(@"set local description err:%@", error);
                                                          return;
                                                      }
                                                      wself.offerCB(wself, sdp);
                                                  }];
                      }];
    
    self.peerConnection = peerConnection;
}

-(void)createPeerConnection:(RTCPeerConnectionFactory*)factory {
    RTCMediaConstraints *constraints = [self defaultPeerConnectionConstraints];
    RTCConfiguration *config = [[RTCConfiguration alloc] init];
    RTCPeerConnection *peerConnection = [factory peerConnectionWithConfiguration:config
                                                                          constraints:constraints
                                                                             delegate:self];
    
    // Create AV senders.
    [self createAudioSender:peerConnection factory:factory];
    [self createVideoSender:peerConnection factory:factory];
    
    //default disable video
//    self.videoTrack.isEnabled = NO;
    [self.videoTrack addRenderer:self.videoView];

    
    // Send offer.
    __weak Participant *wself = self;
    [peerConnection offerForConstraints:[self sendOnlyOfferConstraints]
                      completionHandler:^(RTCSessionDescription *sdp,
                                          NSError *error) {
                          [wself.peerConnection setLocalDescription:sdp
                                                 completionHandler:^(NSError *error) {
                                                     if (error != nil) {
                                                         NSLog(@"set local description err:%@", error);
                                                         return;
                                                     }
                                                     wself.offerCB(wself, sdp);
                                                 }];
                      }];
    
    self.peerConnection = peerConnection;
}


-(void)dispose {
    [self.peerConnection close];
    self.peerConnection = nil;
}

- (RTCMediaConstraints *)defaultPeerConnectionConstraints {
    NSString *value = @"true";
    NSDictionary *optionalConstraints = @{@"DtlsSrtpKeyAgreement" : value ,
                                          @"video":@"true",
                                          @"audio":@"true"};
    RTCMediaConstraints* constraints =
    [[RTCMediaConstraints alloc] initWithMandatoryConstraints:nil
                                          optionalConstraints:optionalConstraints];
    return constraints;
}

- (RTCMediaConstraints *)recvOnlyOfferConstraints {
    NSDictionary *mandatoryConstraints = @{
                                           @"OfferToReceiveAudio" : @"true",
                                           @"OfferToReceiveVideo" : @"true"
                                           };
    RTCMediaConstraints* constraints =
    [[RTCMediaConstraints alloc] initWithMandatoryConstraints:mandatoryConstraints
                                          optionalConstraints:nil];
    return constraints;
}


- (RTCMediaConstraints *)sendOnlyOfferConstraints {
    NSDictionary *mandatoryConstraints = @{
                                           @"OfferToReceiveAudio" : @"false",
                                           @"OfferToReceiveVideo" : @"false"
                                           };
    RTCMediaConstraints* constraints =
    [[RTCMediaConstraints alloc] initWithMandatoryConstraints:mandatoryConstraints
                                          optionalConstraints:nil];
    return constraints;
}


- (RTCRtpSender *)createAudioSender:(RTCPeerConnection*)peerConnection factory:(RTCPeerConnectionFactory*)factory {
    RTCAudioTrack *track = [factory audioTrackWithTrackId:kARDAudioTrackId];
    
    RTCRtpSender *sender =
    [peerConnection senderWithKind:kRTCMediaStreamTrackKindAudio
                          streamId:kARDMediaStreamId];
    if (track) {
        sender.track = track;
        self.audioTrack = track;
    }
    return sender;
}


- (RTCRtpSender *)createVideoSender:(RTCPeerConnection*)peerConnection factory:(RTCPeerConnectionFactory*)factory {
    RTCRtpSender *sender = [peerConnection senderWithKind:kRTCMediaStreamTrackKindVideo
                                                 streamId:kARDMediaStreamId];
    RTCVideoTrack *track = [self createLocalVideoTrack:peerConnection factory:factory];
    if (track) {
        sender.track = track;
        self.videoTrack = track;
    }
    return sender;
}


- (RTCVideoTrack *)createLocalVideoTrack:(RTCPeerConnection*)peerConnection factory:(RTCPeerConnectionFactory*)factory {
    RTCVideoTrack* localVideoTrack = nil;
    // The iOS simulator doesn't provide any sort of camera capture
    // support or emulation (http://goo.gl/rHAnC1) so don't bother
    // trying to open a local stream.
#if !TARGET_IPHONE_SIMULATOR
    RTCMediaConstraints *cameraConstraints = [self cameraConstraints];
    RTCAVFoundationVideoSource *source = [factory avFoundationVideoSourceWithConstraints:cameraConstraints];
    localVideoTrack = [factory videoTrackWithSource:source
                                            trackId:kARDVideoTrackId];


#endif
    return localVideoTrack;
}


- (RTCMediaConstraints *)cameraConstraints {
    NSDictionary *mediaConstraintsDictionary = @{
                                                 kRTCMediaConstraintsMinWidth : @"640",
                                                 kRTCMediaConstraintsMinHeight : @"480",
                                                 kRTCMediaConstraintsMinFrameRate: @"15",
                                                 };
    
    RTCMediaConstraints *cameraConstraints = [[RTCMediaConstraints alloc]
                                              initWithMandatoryConstraints:nil
                                              optionalConstraints: mediaConstraintsDictionary];
    
    return cameraConstraints;
}



#pragma mark - RTCPeerConnectionDelegate
// Callbacks for this delegate occur on non-main thread and need to be
// dispatched back to main queue as needed.
- (void)peerConnection:(RTCPeerConnection *)peerConnection
didChangeSignalingState:(RTCSignalingState)stateChanged {
    NSLog(@"Signaling state changed: %ld", (long)stateChanged);
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
          didAddStream:(RTCMediaStream *)stream {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSLog(@"Received %lu video tracks and %lu audio tracks",
              (unsigned long)stream.videoTracks.count,
              (unsigned long)stream.audioTracks.count);
        if (stream.videoTracks.count) {
            RTCVideoTrack *videoTrack = stream.videoTracks[0];
            NSLog(@"did receive remote video track");
            self.videoTrack = videoTrack;
            [self.videoTrack addRenderer:self.videoView];
        }
        if (stream.audioTracks.count) {
            RTCAudioTrack *audioTrack = stream.audioTracks[0];
            self.audioTrack = audioTrack;
        }
    });
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
       didRemoveStream:(RTCMediaStream *)stream {
    NSLog(@"Stream was removed.");
}

- (void)peerConnectionShouldNegotiate:(RTCPeerConnection *)peerConnection {
    NSLog(@"WARNING: Renegotiation needed but unimplemented.");
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
didChangeIceConnectionState:(RTCIceConnectionState)newState {
    NSLog(@"ICE state changed: %ld", (long)newState);
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
didChangeIceGatheringState:(RTCIceGatheringState)newState {
    NSLog(@"ICE gathering state changed: %ld", (long)newState);
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
didGenerateIceCandidate:(RTCIceCandidate *)candidate {
    self.iceCB(self, candidate);
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
didRemoveIceCandidates:(NSArray<RTCIceCandidate *> *)candidates {
    //todo send remove ice candidate to peer
}

- (void)peerConnection:(RTCPeerConnection *)peerConnection
    didOpenDataChannel:(RTCDataChannel *)dataChannel {
    NSLog(@"did open data channel");
}

@end
