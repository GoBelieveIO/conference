
import {
    CONFERENCE_JOINED,
    CONFERENCE_LEFT,
    CONFERENCE_WILL_LEAVE,
    SET_ROOM
} from './actionTypes';
import './middleware';
import './reducer';


/**
 * Attach any pre-existing local media to the conference once the conference has
 * been joined.
 *
 * @param {JitsiConference} conference - The JitsiConference instance which was
 * joined by the local participant.
 * @returns {Function}
 */
export function conferenceJoined(conference) {
    return {
        type: CONFERENCE_JOINED,
        conference: {
            jitsiConference: conference
        }
    };
}

/**
 * Signal that we have left the conference.
 *
 * @param {JitsiConference} conference - The JitsiConference instance which was
 * left by the local participant.
 * @returns {{
 *      type: CONFERENCE_LEFT,
 *      conference: {
 *          jitsiConference: JitsiConference
 *      }
 *  }}
 */
export function conferenceLeft(conference) {
    return {
        type: CONFERENCE_LEFT,
        conference: {
            jitsiConference: conference
        }
    };
}

/**
 * Signal the intention of the application to have the local participant leave a
 * specific conference. Similar in fashion to CONFERENCE_LEFT. Contrary to it
 * though, it's not guaranteed because CONFERENCE_LEFT may be triggered by
 * lib-jitsi-meet and not the application.
 *
 * @param {JitsiConference} conference - The JitsiConference instance which will
 * be left by the local participant.
 * @returns {{
 *      type: CONFERENCE_LEFT,
 *      conference: {
 *          jitsiConference: JitsiConference
 *      }
 *  }}
 */
export function conferenceWillLeave(conference) {
    return {
        type: CONFERENCE_WILL_LEAVE,
        conference: {
            jitsiConference: conference
        }
    };
}

/**
 * Sets (the name of) the room of the conference to be joined.
 *
 * @param {(string|undefined)} room - The name of the room of the conference to
 * be joined.
 * @returns {{
 *      type: SET_ROOM,
 *      room: string
 *  }}
 */
export function setRoom(room) {
    return {
        type: SET_ROOM,
        room
    };
}
