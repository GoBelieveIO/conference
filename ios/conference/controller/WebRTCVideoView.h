//
//  WebRTCVideoView.h
//  conference
//
//  Created by houxh on 2018/8/12.
//  Copyright © 2018年 beetle. All rights reserved.
//
#import <AVFoundation/AVFoundation.h>

#import <Foundation/Foundation.h>
#import <WebRTC/RTCEAGLVideoView.h>
#import <WebRTC/RTCMediaStream.h>
#import <WebRTC/RTCVideoFrame.h>
#import <WebRTC/RTCVideoTrack.h>


typedef NS_ENUM(NSInteger, WebRTCVideoViewObjectFit) {
    /**
     * The contain value defined by https://www.w3.org/TR/css3-images/#object-fit:
     *
     * The replaced content is sized to maintain its aspect ratio while fitting
     * within the element's content box.
     */
    WebRTCVideoViewObjectFitContain,
    /**
     * The cover value defined by https://www.w3.org/TR/css3-images/#object-fit:
     *
     * The replaced content is sized to maintain its aspect ratio while filling
     * the element's entire content box.
     */
    WebRTCVideoViewObjectFitCover
};


@interface WebRTCVideoView :  UIView <RTCVideoRenderer, RTCVideoViewDelegate>

/**
 * The indicator which determines whether this {@code RTCVideoView} is to mirror
 * the video specified by {@link #videoTrack} during its rendering. Typically,
 * applications choose to mirror the front/user-facing camera.
 */
@property (nonatomic) BOOL mirror;

/**
 * In the fashion of
 * https://www.w3.org/TR/html5/embedded-content-0.html#dom-video-videowidth
 * and https://www.w3.org/TR/html5/rendering.html#video-object-fit, resembles
 * the CSS style {@code object-fit}.
 */
@property (nonatomic) WebRTCVideoViewObjectFit objectFit;





@end
