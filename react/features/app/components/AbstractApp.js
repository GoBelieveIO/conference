import React, { Component } from 'react';


import { createStore } from 'redux';
import Thunk from 'redux-thunk';


import {
    MiddlewareRegistry,
    ReducerRegistry
} from '../../base/redux';


import {Conference} from "../../conference"


// Create combined reducer from all reducers in registry.
const reducer = ReducerRegistry.combineReducers();

// Apply all registered middleware from the MiddlewareRegistry + additional
// 3rd party middleware:
// - Thunk - allows us to dispatch async actions easily. For more info
// @see https://github.com/gaearon/redux-thunk.
const middleware = MiddlewareRegistry.applyMiddleware(Thunk);

// Create Redux store with our reducer and middleware.
const store = createStore(reducer, middleware);



/**
 * Base (abstract) class for main App component.
 *
 * @abstract
 */
export class AbstractApp extends Component {

    constructor(props) {
        super(props);
        this.state = {store:store};
    }



    /**
     * Init lib-jitsi-meet and create local participant when component is going
     * to be mounted.
     *
     * @inheritdoc
     */
    componentWillMount() {
    }

    /**
     * Dispose lib-jitsi-meet and remove local participant when component is
     * going to be unmounted.
     *
     * @inheritdoc
     */
    componentWillUnmount() {
    }

    /**
     * Create a ReactElement from the specified component, the specified props
     * and the props of this AbstractApp which are suitable for propagation to
     * the children of this Component.
     *
     * @param {Component} component - The component from which the ReactElement
     * is to be created.
     * @param {Object} props - The read-only React Component props with which
     * the ReactElement is to be initialized.
     * @returns {ReactElement}
     * @protected
     */
    _createElement(component, props) {
        /* eslint-disable no-unused-vars, lines-around-comment */
        const {
            // Don't propagate the config prop(erty) because the config is
            // stored inside the Redux state and, thus, is visible to the
            // children anyway.
            config,
            // Don't propagate the dispatch and store props because they usually
            // come from react-redux and programmers don't really expect them to
            // be inherited but rather explicitly connected.
            dispatch, // eslint-disable-line react/prop-types
            store,
            // The url property was introduced to be consumed entirely by
            // AbstractApp.
            url,
            // The remaining props, if any, are considered suitable for
            // propagation to the children of this Component.
            ...thisProps
        } = this.props;
        /* eslint-enable no-unused-vars, lines-around-comment */

        // eslint-disable-next-line object-property-newline
        return React.createElement(component, { ...thisProps, ...props });
    }
}

/**
 * AbstractApp component's property types.
 *
 * @static
 */
AbstractApp.propTypes = {
    config: React.PropTypes.object,
    store: React.PropTypes.object,

    /**
     * The URL, if any, with which the app was launched.
     */
    url: React.PropTypes.string
};
