import React from "react";
import ReactDOM from "react-dom";

import {connect, Provider} from "react-redux";
import {createStore, combineReducers, bindActionCreators} from 'redux';

import {BrowserRouter, Link, Route, withRouter} from "react-router-dom";

import {deepCopy} from "./util.js";

import SchemasPage from "./schemasPage.jsx";
import ConfigPage from "./configPage.jsx";
import DashboardPage from "./dashboardPage.jsx";

const SET_SRC_CONFIG_ID  = 1;
const SET_DEST_CONFIG_ID = 2;

const SET_DEFAULT_CONFIG_LOADED = 3;

const SET_DEFAULT_SRC_CONFIGS  = 4;
const SET_DEFAULT_DEST_CONFIGS = 5;

const SET_SRC_CONFIGS  = 6;
const SET_DEST_CONFIGS = 7;

const SET_SCHEMAS = 8;
const SET_SCHEMAS_LOADED = 9;
const SET_SCHEMAS_FILENAME = 10;

const TOGGLE_FILTER = 11;
const TOGGLE_SNAPSHOT_LOAD = 12;

const RESET_FILTER = 13;
const RESET_SNAPSHOT_LOAD = 14;

const SET_CONFIG_SENT = 15;

const SET_SELECTED_SCHEMAS = 16;
const SET_REPLICANT_RUNNING = 17;

const replicantRunningReducer = (replicantRunning=false, action) => {
    if (action.type == SET_REPLICANT_RUNNING) {
        return action.isRunning;
    }

    return replicantRunning;
};

const configsIdReducer = (configsId={source: '', destination: ''}, action) => {
	let newCurrentDestConfigId = configsId.destination;
	let newCurrentSrcConfigId  = configsId.source;

	if (action.type === SET_DEST_CONFIG_ID) {
		newCurrentDestConfigId = action.configId;
	} else if (action.type === SET_SRC_CONFIG_ID) {
		newCurrentSrcConfigId = action.configId;
	}

	return {source: newCurrentSrcConfigId, destination: newCurrentDestConfigId};
};

const defaultConfigsReducer = (defaultConfigs={source:{}, destination:{}}, action) => {
	let newDefaultDestConfigs = defaultConfigs.destination;
	let newDefaultSrcConfigs = defaultConfigs.source;

	if (action.type === SET_DEFAULT_DEST_CONFIGS) {
		newDefaultDestConfigs = action.defaultConfigs;
	} else if (action.type === SET_DEFAULT_SRC_CONFIGS) {
		newDefaultSrcConfigs = action.defaultConfigs;
	}

	return {source: newDefaultSrcConfigs, destination: newDefaultDestConfigs};
};

const configsReducer = (configs={source:{}, destination:{}}, action) => {
	let newDestConfigs = configs.destination;
	let newSrcConfigs  = configs.source;

	if (action.type === SET_DEST_CONFIGS) {
		newDestConfigs = action.configs;
	} else if (action.type === SET_SRC_CONFIGS) {
		newSrcConfigs = action.configs;
	}

	return {source: newSrcConfigs, destination: newDestConfigs};
};

const schemasReducer = (schemas=null, action) => {
	if (action.type === SET_SCHEMAS) {
		return action.schemas;
	}

	return schemas;
};

const schemasFilenameReducer = (schemasFilename='', action) => {
	if (action.type === SET_SCHEMAS_FILENAME) {
		return action.filename;
	}

	return schemasFilename;
};

const defaultConfigsLoadedReducer = (defaultConfigsLoaded=false, action) => {
	if (action.type === SET_DEFAULT_CONFIG_LOADED) {
		return action.isLoaded;
	}

	return defaultConfigsLoaded;
};

const filterReducer = (filter=false, action) => {
	if (action.type === TOGGLE_FILTER) {
		return !store.getState().filter;
	} else if (action.type === RESET_FILTER) {
		return false;
	}

	return filter;
};

const snapshotLoadReducer = (snapshotLoad=false, action) => {
	if (action.type === TOGGLE_SNAPSHOT_LOAD) {
		return !store.getState().snapshotLoad;
	} else if (action.type === RESET_SNAPSHOT_LOAD) {
		return false;
	}

	return snapshotLoad;
};

const configSentToServerReducer = (configSent=false, action) => {
	if (action.type === SET_CONFIG_SENT) {
		return action.isSent;
	}

	return configSent;
};

const selectedSchemasReducer = (selectedSchemas=[], action) => {
	if (action.type === SET_SELECTED_SCHEMAS) {
		return action.schemas;
	}

	return selectedSchemas;
};

const store = createStore(combineReducers({
	defaultConfigsLoaded: defaultConfigsLoadedReducer,
	configsId: configsIdReducer,

	selectedSchemas: selectedSchemasReducer,
	defaultConfigs: defaultConfigsReducer,

	schemas: schemasReducer,
	configs: configsReducer,

	filter: filterReducer,
	snapshotLoad: snapshotLoadReducer,

	configSentToServer: configSentToServerReducer,
    replicantRunning: replicantRunningReducer
}));

function Application() {
	return (
		<Provider store={store}>
			<BrowserRouter>
				<div>
					<HeaderWrapper/>

					<div className="container-fluid" style={{"height": "100%"}}>
						<Route exact path={'/'} component={DashboardPageWrapper}/>
						<Route path={"/config/"} component={ConfigPageWrapper}/>

						<Route path={"/schemas/"} component={SchemasPageWrapper}/>
						<Route path={"/dashboard/"} component={DashboardPageWrapper}/>
					</div>
				</div>
			</BrowserRouter>
		</Provider>
	);
}

class Header extends React.Component {
	constructor(props) {
		super();

		this.goToDashboard = this.goToDashboard.bind(this);
	}

	goToDashboard(event) {
		event.preventDefault();

		if (this.props.location.pathname != "/dashboard/") {
			this.props.history.push("/dashboard/");
		}
	}

	render() {
		return (
			<nav className="navbar navbar-inverse navbar-fixed-top" role="navigation">
				<div className="container-fluid">
					<div className="navbar-header">
						<a className="navbar-brand" href=''>ReplicantTech</a>

						<button type="button" className="navbar-toggle collapsed"
						data-toggle="collapse" data-target="#navbarBody"
						aria-expanded="false" aria-controls="#navbarBody">
							<span className="sr-only">Toggle navigation</span>
							<span className="icon-bar"></span>
							<span className="icon-bar"></span>
							<span className="icon-bar"></span>
						</button>
					</div>

					<div id="navbarBody" className="collapse navbar-collapse">
						<ul className="nav navbar-nav navbar-right">
							<li>
								<a href='' onClick={this.goToDashboard}>
									Dashboard
								</a>
							</li>
						</ul>
					</div>
				</div>
			</nav>
		);
	}
}

const HeaderWrapper = withRouter(Header);

/* Returns configuration as needed by replicant */
function formatConfig(config) {
	if (config == null) return {};

	return Object.assign({}, {"connection":
		config.connectionParams.reduce((newConfig, param) => {
			newConfig[param.id] = param.value;
			return newConfig;
		}, {})},
		config.advancedParams.reduce((newConfig, param) => {
			newConfig[param.id] = param.value;
			return newConfig;
		}, {})
	);
}

function getReplicationStartForm() {
	const state = store.getState();
	const form = new FormData();

	form.set("snapshotLoad", state.snapshotLoad);

	if (!state.configSentToServer) {
		const srcConfigId = state.configsId.source;
		const destConfigId = state.configsId.destination;

		const srcConfig = state.configs.source[srcConfigId];
		const destConfig = state.configs.destination[destConfigId];

		const config = {
		    source: Object.assign({},
			{type: srcConfigId},
			formatConfig(srcConfig)
		    ),
		    destination: Object.assign({},
			{type: destConfigId},
			formatConfig(destConfig)
		    )
		}

		form.set("config", JSON.stringify(config));
	}

    // TODO: This check can probably be removed when empty schemas handling is fixed
    if (Object.keys(state.selectedSchemas).length > 0) {
	let schemas;

	if (state.filter) {
	    schemas = {"table-schemas":
		state.selectedSchemas.reduce((schemas, tableName) => {
		    schemas[tableName] = {
			schema: state.schemas[tableName]
		    };

		    return schemas;
		}, {})
	    };

	    schemas["table-filter"] = {
		tables: state.selectedSchemas,
		"inverse-match": false
	    }
	} else {
	    schemas = {"table-schemas": {}};
	    for (let tableName in state.schemas) {
		schemas["table-schemas"][tableName] = {
		    schema: state.schemas[tableName]
		};
	    }
	}

        /* Pick out only selected schemas */
        form.set("schemas", JSON.stringify(schemas));
    }

	return form;
}

// TODO: Security issues and encoding???
/* TODO: Needs to be implemented more safely */
function startReplication(callbackFcn=()=>{}) {
	const replicationStartRequest = new XMLHttpRequest();

	replicationStartRequest.addEventListener("load", () => {
		store.dispatch({type: SET_REPLICANT_RUNNING, isRunning: true});
		store.dispatch({type: SET_CONFIG_SENT, isSent: true});

		callbackFcn();
	});

	replicationStartRequest.addEventListener("error", error => {
		callbackFcn(error.target.response);
	});

	replicationStartRequest.open("POST", "/replicant_start/");
	replicationStartRequest.send(getReplicationStartForm());
}

function setParams(parameters, newParameters) {
	for (let id in newParameters) {
		for (let i in parameters) {
			if (parameters[i].id === id) {
				parameters[i].value = newParameters[id];
			}
		}
	}
}

function updateConfigs(configs, newConfigs, defaultConfigs) {
	store.dispatch({type: SET_CONFIG_SENT, isSent: false});

	for (let configId in newConfigs) {
		if (!defaultConfigs[configId].disabled) {
			configs[configId] = deepCopy(defaultConfigs[configId]);

			const config = configs[configId];
			const newConfig = newConfigs[configId];

			setParams(config.connectionParams, newConfig);
			setParams(config.advancedParams, newConfig);
		}
	}
}

function resetConfigs() {
	store.dispatch({type: SET_CONFIG_SENT, isSent: false});

	// TODO: Add browse reset???
	const defaultSrcConfigs = store.getState().defaultConfigs.source;
	const defaultDestConfigs = store.getState().defaultConfigs.destination;

	store.dispatch({type: RESET_FILTER});
	store.dispatch({type: RESET_SNAPSHOT_LOAD});

	store.dispatch({type: SET_SRC_CONFIG_ID, configId: ''});
	store.dispatch({type: SET_DEST_CONFIG_ID, configId: ''});

	store.dispatch({type: SET_SRC_CONFIGS, configs: deepCopy(defaultSrcConfigs)});
	store.dispatch({type: SET_DEST_CONFIGS, configs: deepCopy(defaultDestConfigs)});
}

const configActionCreators = {
	/* Places default configurations in the Redux store*/
	storeDefaultConfigs: (srcConfigs, destConfigs) => {
		store.dispatch({type: SET_DEFAULT_SRC_CONFIGS,  defaultConfigs: srcConfigs});
		store.dispatch({type: SET_DEFAULT_DEST_CONFIGS, defaultConfigs: destConfigs});

		/* Set flag indicating default config was loaded */
		return {type: SET_DEFAULT_CONFIG_LOADED, isLoaded: true};
	},

	storeSrcConfigs: newConfigs => {
		const configs = Object.assign({}, store.getState().configs.source);
		const defaultConfigs = store.getState().defaultConfigs.source;

		const newConfigId = Object.keys(newConfigs)[0];
		if (!defaultConfigs[newConfigId].disabled) {
			store.dispatch({type: SET_SRC_CONFIG_ID, configId: newConfigId});
		}

		updateConfigs(configs, newConfigs, defaultConfigs);
		return {type: SET_SRC_CONFIGS, configs: configs};
	},

	storeDestConfigs: newConfigs => {
		const configs = Object.assign({}, store.getState().configs.destination);
		const defaultConfigs = store.getState().defaultConfigs.destination;

		const newConfigId = Object.keys(newConfigs)[0];
		if (!defaultConfigs[newConfigId].disabled) {
			store.dispatch({type: SET_DEST_CONFIG_ID, configId: newConfigId});
		}

		updateConfigs(configs, newConfigs, defaultConfigs);
		return {type: SET_DEST_CONFIGS, configs: configs};
	},

	/* Toggles snapshot load flag */
	toggleSnapshotLoad: () => ({type: TOGGLE_SNAPSHOT_LOAD}),

	/* Changes currently selected source database */
	changeSrcForm: srcConfigId => {
		store.dispatch({type: SET_CONFIG_SENT, isSent: false});

		const srcConfigs = store.getState().configs.source;
		if (srcConfigId != '' && !srcConfigs.hasOwnProperty(srcConfigId)) {
			const srcDefaultConfigs = store.getState().defaultConfigs.source;
			const newConfig = deepCopy(srcDefaultConfigs[srcConfigId]);

			// TODO: Make prettier
			const newConfigs = Object.assign({}, srcConfigs, {[srcConfigId]: newConfig});

			store.dispatch({type: SET_SRC_CONFIGS, configs: newConfigs});
		}

		return {type: SET_SRC_CONFIG_ID, configId: srcConfigId};
	},

	/* Changes currently selected destination database */
	changeDestForm: destConfigId => {
		store.dispatch({type: SET_CONFIG_SENT, isSent: false});

		const destConfigs = store.getState().configs.destination;
		if (destConfigId != '' && !destConfigs.hasOwnProperty(destConfigId)) {
			const destDefaultConfigs = store.getState().defaultConfigs.destination;
			const newConfig = deepCopy(destDefaultConfigs[destConfigId]);
			// TODO: Make prettier
			const newConfigs = Object.assign({}, destConfigs, {[destConfigId]: newConfig});

			store.dispatch({type: SET_DEST_CONFIGS, configs: newConfigs});
		}

		return {type: SET_DEST_CONFIG_ID, configId: destConfigId};
	},

	/* Changes source database parameter */
	changeSrcParam: (configId, paramGroup, paramIdx, newValue) => {
		store.dispatch({type: SET_CONFIG_SENT, isSent: false});

		// TODO: Copy entire tree path???
		const newConfigs = Object.assign({}, store.getState().configs.source);
		newConfigs[configId] = Object.assign({}, newConfigs[configId]);
		newConfigs[configId][paramGroup][paramIdx].value = newValue;

		return {type: SET_SRC_CONFIGS, configs: newConfigs};
	},

	/* Changes destination database parameter */
	changeDestParam: (configId, paramGroup, paramIdx, newValue) => {
		store.dispatch({type: SET_CONFIG_SENT, isSent: false});

		// TODO: Copy entire tree path???
		const newConfigs = Object.assign({}, store.getState().configs.destination);
		newConfigs[configId] = Object.assign({}, newConfigs[configId]);
		newConfigs[configId][paramGroup][paramIdx].value = newValue;

		return {type: SET_DEST_CONFIGS, configs: newConfigs};
	}
}

const ConfigPageWrapper = connect(
	function mapStateToProps(state) {
		const {source: srcConfigId, destination: destConfigId} = state.configsId;

		return {
			defaultConfigsLoaded: state.defaultConfigsLoaded,

			srcDefaultConfigs: state.defaultConfigs.source,
			destDefaultConfigs: state.defaultConfigs.destination,

			srcConfigId: srcConfigId,
			destConfigId: destConfigId,

			//TODO: Necesarry to send copy???
			srcConfig: state.configs.source[srcConfigId],
			destConfig: state.configs.destination[destConfigId],

			snapshotLoad: state.snapshotLoad,

			resetConfigs: resetConfigs,

			replicantRunning: state.replicantRunning,

			//TODO: This is not a state, but own prop. Change this!!!
			startReplication: startReplication
		};
	},
	configActionCreators
)(ConfigPage);

const SchemasPageWrapper = connect(
	function mapStateToProps(state) {
		const {source: srcConfigId, destination: destConfigId} = state.configsId;

		const srcConfig = state.configs.source[srcConfigId];
		const destConfig = state.configs.destination[destConfigId];

		return {
			srcConfigId: srcConfigId,
			destConfigId: destConfigId,

			srcConfig: formatConfig(srcConfig),
			destConfig: formatConfig(destConfig),

			configSentToServer: state.configSentToServer,

			schemasFilename: state.schemasFilename,
			selectedSchemas: state.selectedSchemas,

			schemas: state.schemas,
			filter: state.filter,

			replicantRunning: state.replicantRunning,

			//TODO: This is not a state, but own prop. Change this!!!
			startReplication: startReplication
		};
	},
	function mapDispatchToProps(dispatch) {
		return bindActionCreators({
            toggleFilter: () => ({type: TOGGLE_FILTER}),

			setConfigSentToServer: () => ({type: SET_CONFIG_SENT, isSent: true}),
			updateSchemas: newSchemas => ({type: SET_SCHEMAS, schemas: newSchemas}),
			updateSchemasChoice: schemas => ({type: SET_SELECTED_SCHEMAS, schemas: schemas})
		}, dispatch);
	}
)(SchemasPage);

const dashboardActionCreators = {
	setReplicantRunning: running => ({type: SET_REPLICANT_RUNNING, isRunning: running}),
	resetSchemas: () => {
		store.dispatch({type: SET_SELECTED_SCHEMAS, schemas: []});
		return {type: SET_SCHEMAS, schemas: null};
	}
};

const DashboardPageWrapper = connect(
	function mapStateToProps(state) {
		return {
			replicantRunning: state.replicantRunning,
			snapshotLoad: state.snapshotLoad,

			// TODO: Not a state!!!
			resetConfigs: resetConfigs
		};
	},
	function mapDispatchToProps(dispatch) {
		return bindActionCreators(dashboardActionCreators, dispatch);
	}
)(DashboardPage);

ReactDOM.render(<Application/>, document.getElementById('application'));

