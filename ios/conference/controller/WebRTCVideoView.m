//
//  WebRTCVideoView.m
//  conference
//
//  Created by houxh on 2018/8/12.
//  Copyright © 2018年 beetle. All rights reserved.
//

#import "WebRTCVideoView.h"
@interface WebRTCVideoView()
@property(nonatomic, assign) CGSize videoSize;
@property(nonatomic, weak) RTCEAGLVideoView *subview;
@end


@implementation WebRTCVideoView

/**
 * Initializes and returns a newly allocated view object with the specified
 * frame rectangle.
 *
 * @param frame The frame rectangle for the view, measured in points.
 */
- (instancetype)initWithFrame:(CGRect)frame {
    if (self = [super initWithFrame:frame]) {
        RTCEAGLVideoView *subview = [[RTCEAGLVideoView alloc] init];
        
        subview.delegate = self;
        
        _videoSize.height = 0;
        _videoSize.width = 0;
        
        self.opaque = NO;
        [self addSubview:subview];
        self.subview = subview;
    }
    return self;
}



/**
 * Lays out the subview of this instance while preserving the aspect ratio of
 * the video it renders.
 */
- (void)layoutSubviews {
    [super layoutSubviews];
    
    UIView *subview = self.subview;
    if (!subview) {
        return;
    }
    
    CGFloat width = _videoSize.width, height = _videoSize.height;
    CGRect newValue;
    if (width <= 0 || height <= 0) {
        newValue.origin.x = 0;
        newValue.origin.y = 0;
        newValue.size.width = 0;
        newValue.size.height = 0;
    } else if (WebRTCVideoViewObjectFitCover == self.objectFit) { // cover
        newValue = self.bounds;
        // Is there a real need to scale subview?
        if (newValue.size.width != width || newValue.size.height != height) {
            CGFloat scaleFactor
            = MAX(newValue.size.width / width, newValue.size.height / height);
            // Scale both width and height in order to make it obvious that the aspect
            // ratio is preserved.
            width *= scaleFactor;
            height *= scaleFactor;
            newValue.origin.x += (newValue.size.width - width) / 2.0;
            newValue.origin.y += (newValue.size.height - height) / 2.0;
            newValue.size.width = width;
            newValue.size.height = height;
        }
    } else { // contain
        // The implementation is in accord with
        // https://www.w3.org/TR/html5/embedded-content-0.html#the-video-element:
        //
        // In the absence of style rules to the contrary, video content should be
        // rendered inside the element's playback area such that the video content
        // is shown centered in the playback area at the largest possible size that
        // fits completely within it, with the video content's aspect ratio being
        // preserved. Thus, if the aspect ratio of the playback area does not match
        // the aspect ratio of the video, the video will be shown letterboxed or
        // pillarboxed. Areas of the element's playback area that do not contain the
        // video represent nothing.
        newValue
        = AVMakeRectWithAspectRatioInsideRect(
                                              CGSizeMake(width, height),
                                              self.bounds);
    }
    
    CGRect oldValue = subview.frame;
    if (newValue.origin.x != oldValue.origin.x
        || newValue.origin.y != oldValue.origin.y
        || newValue.size.width != oldValue.size.width
        || newValue.size.height != oldValue.size.height) {
        subview.frame = newValue;
    }
    
    subview.transform
    = self.mirror
    ? CGAffineTransformMakeScale(-1.0, 1.0)
    : CGAffineTransformIdentity;
}

/**
 * Implements the setter of the {@link #mirror} property of this
 * {@code RTCVideoView}.
 *
 * @param mirror The value to set on the {@code mirror} property of this
 * {@code RTCVideoView}.
 */
- (void)setMirror:(BOOL)mirror {
    if (_mirror != mirror) {
        _mirror = mirror;
        [self setNeedsLayout];
    }
}

/**
 * Implements the setter of the {@link #objectFit} property of this
 * {@code RTCVideoView}.
 *
 * @param objectFit The value to set on the {@code objectFit} property of this
 * {@code RTCVideoView}.
 */
- (void)setObjectFit:(WebRTCVideoViewObjectFit)objectFit {
    if (_objectFit != objectFit) {
        _objectFit = objectFit;
        [self setNeedsLayout];
    }
}




#pragma mark - RTCVideoRenderer methods

/**
 * Renders a specific video frame. Delegates to the subview of this instance
 * which implements the actual {@link RTCVideoRenderer}.
 *
 * @param frame The video frame to render.
 */
- (void)renderFrame:(RTCVideoFrame *)frame {
    id<RTCVideoRenderer> videoRenderer = self.subview;
    if (videoRenderer) {
        [videoRenderer renderFrame:frame];
    }
}

/**
 * Sets the size of the video frame to render.
 *
 * @param size The size of the video frame to render.
 */
- (void)setSize:(CGSize)size {
    id<RTCVideoRenderer> videoRenderer = self.subview;
    if (videoRenderer) {
        [videoRenderer setSize:size];
    }
}

#pragma mark - RTCEAGLVideoViewDelegate methods

/**
 * Notifies this {@link RTCEAGLVideoViewDelegate} that a specific
 * {@link RTCEAGLVideoView} had the size of the video (frames) it renders
 * changed.
 *
 * @param videoView The {@code RTCEAGLVideoView} which had the size of the video
 * (frames) it renders changed to the specified size.
 * @param size The new size of the video (frames) to be rendered by the
 * specified {@code videoView}.
 */
- (void)videoView:(RTCEAGLVideoView *)videoView didChangeVideoSize:(CGSize)size {
    if (videoView == self.subview) {
        _videoSize = size;
        [self setNeedsLayout];
    }
}
@end
