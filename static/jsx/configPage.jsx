import yaml from "js-yaml";
import React from "react";

import {
	SourceDatabaseMenu, DestinationDatabaseMenu,
	SourceConfigForm, DestinationConfigForm
} from './configForms.jsx';

function fillUnknowns(configs) {
	for (let i in configs) {
		if (configs[i].connectionParams == null) {
			configs[i].connectionParams = [];
		}

		if (configs[i].advancedParams == null) {
			configs[i].advancedParams = [];
		}
	}
}

class NavigationPanel extends React.Component {
	constructor() {
		super();

		this.goToSchemasPage = this.goToSchemasPage.bind(this);
		this.startReplication = this.startReplication.bind(this);
	}

	goToSchemasPage(event) {
		event.preventDefault();

		if (!this.props.nextDisabled) {
			this.props.push("/schemas/");
		}
	}

	startReplication(event) {
		event.preventDefault();

		if (!this.props.nextDisabled) {
			this.props.startReplication(msg => {
				if (msg == null) {
					this.props.push("/dashboard/");
				} else {
					this.setState({errorMsg: errorMsg});
				}
			});
		}
	}

	render() {
		const nextDisabled = this.props.nextDisabled ? " disabled" : '';

        const nextPage = (this.props.srcConfigId == "sasstore") ? (
            <li className={"next" + nextDisabled}>
                <a href='' onClick={this.startReplication}>
                    Start replication
                </a>
            </li>
        ) : (
            <li className={"next" + nextDisabled}>
                <a href='' onClick={this.goToSchemasPage}>
                    Schemas

                    <span aria-hidden="true"> &rarr;</span>
                </a>
            </li>
        );

		return (
			<ul className="pager">
				<li className="previous">
					<a href='' onClick={this.props.resetConfigs}> Reset to defaults </a>
				</li>

				<emp> Configuration board </emp>

                {nextPage}
			</ul>
		);
	}
}

class ConfigPage extends React.Component {
	constructor() {
		super();

		this.state = {
			errorMsg: null,
			configsLoading: false
		};

		this.importConfigs = this.importConfigs.bind(this);
		this.fetchDefaultConfigs = this.fetchDefaultConfigs.bind(this);
	}

	componentDidMount() {
		if (!this.props.defaultConfigsLoaded) this.fetchDefaultConfigs();
	}

	fetchDefaultConfigs() {
		this.setState({configsLoading: true});

		const fetchConfigsRequest = new XMLHttpRequest();

		fetchConfigsRequest.addEventListener("load", request => {
			try {
				// TODO: use responseText or getConfigsRequest.response or request.respose???
				const defaultConfigs = JSON.parse(request.target.response)["default_configs"];
				const {source: srcConfigs={}, destination: destConfigs={}} = defaultConfigs;

				fillUnknowns(srcConfigs);
				fillUnknowns(destConfigs);

				this.props.storeDefaultConfigs(srcConfigs, destConfigs);
				this.setState({configsLoading: false});
			} catch(error) {
				this.setState({
					errorMsg: {
						title: "Default configuration file JSON format error",
						body: '"default.yml" file is not a valid JSON syntax:' + error
					}
				});

				return;
			} finally {
				this.setState({configsLoading: false});
			}
		});

		// TODO: Verify!!!
		fetchConfigsRequest.addEventListener("error", error => {
			this.setState({errorMsg: error.target.response});
			this.setState({configsLoading: false});
		});

		fetchConfigsRequest.open("GET", "/fetch_default_configs/");
		fetchConfigsRequest.send();
	}

	importConfigs(event) {
		const file = event.target.files[0];

		if (!this.state.configsLoading && file != null) {
			this.setState({configsLoading: true});
			this.setState({errorMsg: null});

			const configReader = new FileReader();

			configReader.addEventListener("loadend", event => {
				let newConfigs;

				try {
					newConfigs = yaml.safeLoad(event.target.result);
				} catch (error) {
					this.setState({
						errorMsg: {
							title: "Imported file YAML format error",
							body: "Imported file is not a valid YAML syntax:" + error
						}
					});

					return;
				} finally {
					this.setState({configsLoading: false});
				}

				const {source: srcConfigs, destination: destConfigs} = newConfigs;

				try {
					/* Allow only non-empty configurations */
					if (srcConfigs != null && Object.keys(srcConfigs).length > 0) {
						this.props.storeSrcConfigs(srcConfigs);
					}
					if (destConfigs != null && Object.keys(destConfigs).length > 0) {
						this.props.storeDestConfigs(destConfigs);
					}
				} catch(error) {
					this.setState({
						errorMsg: {
							title: "Imported file format error",
							body: "Imported file is not in a valid format"
						}
					});
				} finally {
					this.setState({configsLoading: false});
				}
			});

			//TODO: Verify
			configReader.addEventListener("error", error => {
				this.setState({errorMsg: error.target.response});
				this.setState({configsLoading: false});
			});

			configReader.readAsText(file);
		}
	}

	// TODO: Add message that configs are loading or being imported!!!
	render() {
		const disableNext = this.props.srcConfigId == '' || this.props.destConfigId == ''
                         || this.state.configsLoading || this.state.errorMsg != null

		// TODO: Use modal for errors!!!
		return (
			<div>
				<NavigationPanel nextDisabled={disableNext}
					startReplication={this.props.startReplication}
					replicantRunning={this.props.replicantRunning}
					resetConfigs={this.props.resetConfigs}
                    srcConfigId={this.props.srcConfigId}
					push={this.props.history.push}/>

				{this.state.errorMsg != null &&
					<div className="panel panel-danger">
						<div className="panel-heading">
							<h3 className="panel-title">
								{this.state.errorMsg.title}
							</h3>
						</div>
						<div className="panel-body">
							{this.state.errorMsg.body}
						</div>
					</div>
				}

				<div className="row col-md-12" style={{"marginBottom": "14px"}}>
					<button type="button" className="btn btn-warning"
						onClick={() => {this.configsFile.click()}}
						disabled={this.state.configsLoading}>
						Import configuration
					</button>

					<span style={{display: "none"}}>
						<input ref={input => {this.configsFile= input}}
						type="file" onChange={this.importConfigs}/>
					</span>

					<label className="checkbox-inline" style={{"marginLeft":"12px"}}>
						<input type="checkbox"
							onChange={this.props.toggleSnapshotLoad}
							checked={this.props.snapshotLoad}/>
						Snapshot load
					</label>
				</div>

				<form className="row">
					<div className="form-group">
						<div className="col-md-6" style={{"overflow": "auto"}}>
							<SourceDatabaseMenu onChange={this.props.changeSrcForm}
								configs={this.props.srcDefaultConfigs}
								configId={this.props.srcConfigId}/>

							<SourceConfigForm onChange={this.props.changeSrcParam}
								configId={this.props.srcConfigId}
								config={this.props.srcConfig}/>
						</div>

						<div className="col-md-6" style={{"overflow": "auto"}}>
							<DestinationDatabaseMenu onChange={this.props.changeDestForm}
								configs={this.props.destDefaultConfigs}
								configId={this.props.destConfigId}/>

							<DestinationConfigForm onChange={this.props.changeDestParam}
								configId={this.props.destConfigId}
								config={this.props.destConfig}/>
						</div>
					</div>
				</form>
			</div>
		);
	}
}

export default ConfigPage;

