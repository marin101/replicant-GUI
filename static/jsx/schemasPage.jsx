import yaml from "js-yaml";
import React from "react";

import {BootstrapTable, TableHeaderColumn} from "react-bootstrap-table";
import "react-bootstrap-table/dist/react-bootstrap-table-all.min.css";

class NavigationPanel extends React.Component {
	constructor() {
		super();

		this.goToConfigsPage= this.goToConfigsPage.bind(this);
		this.startReplication = this.startReplication.bind(this);
	}

	goToConfigsPage(event) {
		event.preventDefault();

		if (!this.props.prevDisabled) {
			this.props.push("/config/");
		}
	}

	startReplication(event) {
		event.preventDefault();

		if (!this.props.nextDisabled) {
			this.props.startReplication(msg => {
				if (msg == null) {
					this.props.push("/dashboard/");
				} else {
					this.setState({errorMsg: msg});
				}
			});
		}
	}

	render() {
		const disablePrev = this.props.prevDisabled ? " disabled" : '';
		const disableNext = this.props.nextDisabled ? " disabled" : '';

		return (
			<ul className="pager">
				<li className={"previous" + disablePrev}>
					<a href='' onClick={this.goToConfigsPage}>
						<span aria-hidden="true">&larr; </span>

						Configuration
					</a>
				</li>

				<emp> Schemas board </emp>

				<li className={"next" + disableNext}>
					<a href='' onClick={this.startReplication}>
						Start replication
					</a>
				</li>
			</ul>
		);
	}
}

class SchemasTable extends React.Component {
	constructor() {
		super();

		this.createButtonGroup = this.createButtonGroup.bind(this);

		this.handleSelect = this.handleSelect.bind(this);
		this.handleSelectAll = this.handleSelectAll.bind(this);
		this.changeTableSchemas = this.changeTableSchemas.bind(this);
		this.deleteTableSchemas = this.deleteTableSchemas.bind(this);
	}

	createButtonGroup(props) {
		return (
			<ButtonGroup className="schemas-table-buttons">
				{props.insertBtn}
				{props.deleteBtn}

				<button type="button" className="btn btn-primary"
					disabled={this.props.schemasLoading}
					onClick={this.props.generateSchemas}>
					Generate
				</button>
				<button type="button" className="btn btn-default"
					onClick={() => {this.schemasFile.click()}}
					disabled={this.props.schemasLoading}>
					Import
				</button>

				<label className="checkbox-inline"
					style={{"marginTop": "5px", "marginLeft": "12px"}}>
					<input type="checkbox" onChange={this.props.toggleFilter}
						checked={this.props.filter}/>
					Filter
				</label>

				<span style={{display: "none"}}>
					<input type="file" ref={input => {this.schemasFile = input}}
						onChange={this.importSchemas}/>
				</span>
			</ButtonGroup>
		);
	}

	deleteTableSchemas(tableNames) {
		// TODO: unnecesarry n^2 complexity!!!
		const selectedSchemas = this.props.selectedSchemas.filter(tableName => {
			if (tableNames.indexOf(tableName) !== -1) {
				return tableName;
			}
		});

		const schemas = Object.assign({}, this.props.schemas);
		for (var tableName of tableNames) {
			delete schemas[tableName];
		}

		this.props.updateSchemas(schemas);
		this.props.updateSchemasChoice(selectedSchemas);
	}

	changeTableSchemas(schema) {
		const schemas = Object.assign({}, this.props.schemas);

		if (!schemas.hasOwnProperty(schema.tableName)) {
			this.props.updateSchemasChoice(this.props.selectedSchemas
				.concat(schemas.tableName)
			);
		}

		schemas[schema.tableName] = schema.tableSchema;
		this.props.updateSchemas(schemas);
	}

	handleSelect(row, isSelected) {
		let selectedSchemas;

		// TODO: Make prettier!!!
		if (isSelected) {
			if (this.props.selectedSchemas.indexOf(row.tableName) === -1) {
				selectedSchemas = this.props.selectedSchemas.concat(row.tableName);
			}
		} else {
			if (this.props.selectedSchemas.indexOf(row.tableName) !== -1) {
				selectedSchemas = this.props.selectedSchemas.filter(tableName => {
					if (tableName != row.tableName) return tableName;
				});
			}
		}

		this.props.updateSchemasChoice(selectedSchemas);

		return true;
	}

	handleSelectAll(isSelected, rows) {
		const selectedSchemas = isSelected ? rows.map(row => row.tableName) : [];
		this.props.updateSchemasChoice(selectedSchemas);

		return true;
	}

	render() {
		let schemas = [];
		for (let tableName in this.props.schemas) {
			let schemaStr = this.props.schemas[tableName];
			schemas.push({tableName: tableName, tableSchema: schemaStr});
		}

		const selectRowProp = {
			mode: "checkbox",

			onSelect: this.handleSelect,
			onSelectAll: this.handleSelectAll,

			selected: this.props.selectedSchemas
		};

		const options = {
			insertText: "Insert row",
			deleteText: "Delete row",

			defaultSortOrder: "asc",
			defaultSortName: "tableName",

			btnGroup: this.createButtonGroup,

			afterInsertRow: this.changeTableSchemas,
			afterDeleteRow: this.deleteTableSchemas,

			noDataText: (this.props.noDataText != null) ? (
				<div className={"panel panel-info"}>
					<div className="panel-heading">
						<h3 className="panel-title" style={{"textAlign": "left"}}>
							{this.props.noDataText.title}
						</h3>
					</div>

					<div className="panel-body" style={{"textAlign": "left"}}>
						{this.props.noDataText.body}
					</div>
				</div>
			) : ''
		};

		const cellEditProp = {
			blurToSave: true,
			mode: 'click',

			afterSaveCell: this.changeTableSchemas
		};

        // TODO: If-else is necesarry for now due to the bug in the react-bootstrap-table
        if (this.props.filter) {
            return (
                <BootstrapTable data={schemas} search condensed striped insertRow deleteRow
                    hover selectRow={selectRowProp} options={options} cellEdit={cellEditProp}>
                    <TableHeaderColumn isKey dataSort editable dataField="tableName">
                        Table name
                    </TableHeaderColumn>

                    <TableHeaderColumn dataField="tableSchema">
                        Table schema
                    </TableHeaderColumn>
                </BootstrapTable>
            );
        } else {
            return (
                <BootstrapTable data={schemas} search condensed striped hover insertRow
                    deleteRow options={options} cellEdit={cellEditProp}>
                    <TableHeaderColumn isKey dataSort editable dataField="tableName">
                        Table name
                    </TableHeaderColumn>

                    <TableHeaderColumn dataField="tableSchema">
                        Table schema
                    </TableHeaderColumn>
                </BootstrapTable>
            );
        }
	}
}

class SchemasPage extends React.Component {
	constructor() {
		super();

		this.state = {
			infoMsg: null,
			errorMsg: null,

			schemasLoading: false,
		};

		this.importSchemas = this.importSchemas.bind(this);
		this.generateSchemas = this.generateSchemas.bind(this);
	}

	generateSchemas() {
		if (!this.state.schemasLoading) {
			this.setState({schemasLoading: true});
			this.setState({errorMsg: null});

			this.props.updateSchemasChoice([]);
			this.props.updateSchemas(null);

			this.setState({
				infoMsg: {
					title: "Generating schemas",
					body: "Please wait"
				}
			});

			const generateSchemasRequest = new XMLHttpRequest();

			generateSchemasRequest.addEventListener("load", request => {
				// TODO: use responseText???
				const schemasInfo = JSON.parse(request.target.response)["schemas"];
				const tableSchemas = schemasInfo["table-schemas"];

				const schemas = {}
				for (let tableName in schemasInfo["table-schemas"]) {
					schemas[tableName] = tableSchemas[tableName].schema;
				}

				const tableNames = (schemas != null) ? Object.keys(schemas) : [];

				this.props.updateSchemas(schemas);
				this.props.updateSchemasChoice(tableNames);

				if (tableNames.length == 0) {
					this.setState({infoMsg: null});
				}

				this.props.setConfigSentToServer();
				this.setState({schemasLoading: false});
			});

			generateSchemasRequest.addEventListener("error", error => {
				this.setState({errorMsg: error.target.response});
				this.setState({schemasLoading: false});
			});

			const configForm = new FormData();

			if (!this.props.configSentToServer) {
				const config = {
				    source: Object.assign({},
					{type: this.props.srcConfigId},
					this.props.srcConfig
				    ),
				    destination: Object.assign({},
					{type: this.props.destConfigId},
					this.props.destConfig
				    )
				}

				configForm.set("config", JSON.stringify(config));
			}

			generateSchemasRequest.open("POST", "/generate_schemas/");
			generateSchemasRequest.send(configForm);
		}
	}

	importSchemas(event) {
		const file = event.target.files[0];

		if (!this.state.schemasLoading && file != null) {
			this.setState({schemasLoading: true});
			this.setState({errorMsg: null});

			this.props.updateSchemasChoice([]);
			this.props.updateSchemas(null);

			this.setState({
				infoMsg: {
					title: "Importing schemas",
					body: "Please wait"
				}
			});

			const schemasReader = new FileReader();

			schemasReader.addEventListener("loadend", request => {
				try {
					const schemas = yaml.safeLoad(request.target.result).tables;
					const tableNames = (schemas != null) ? Object.keys(schemas) : [];

					this.props.updateSchemas(schemas);
					this.props.updateSchemasChoice(tableNames);

					if (tableNames.length == 0) {
						this.setState({infoMsg: null});
					}
				} catch (error) {
					this.setState({
						errorMsg: {
							title: "Imported schemas YAML format error",
							body: "Imported schemas file contains " +
								  "invalid YAML syntax: " + error
						}
					});
				}

				this.setState({schemasLoading: false});
			});

			schemasReader.addEventListener("error", error => {
				this.setState({errorMsg: error.target.response});
				this.setState({schemasLoading: false});
			});

			schemasReader.readAsText(file);
		}
	}

	render() {
		const selectedSchemasCnt = Object.keys(this.props.selectedSchemas).length;
		const disablePrev = this.state.schemasLoading;

		const disableNext = this.props.srcConfigId == '' || this.props.destConfigId == ''
                         || this.props.replicantRunning  || this.state.schemasLoading
                         || (this.props.filter && selectedSchemasCnt <= 0)
                         || this.state.errorMsg != null;

		const disableGenerate = this.props.srcConfigId == '' || this.props.destConfigId == ''
			|| this.state.schemasLoading;

		return (
			<div>
				<NavigationPanel prevDisabled={disablePrev} nextDisabled={disableNext}
					startReplication={this.props.startReplication}
					push={this.props.history.push}/>

				<SchemasTable updateSchemasChoice={this.props.updateSchemasChoice}
					selectedSchemas={this.props.selectedSchemas}
					updateSchemas={this.props.updateSchemas}
					generateSchemas={this.generateSchemas}
                    toggleFilter={this.props.toggleFilter}
					schemasLoading={disableGenerate}
					noDataText={this.state.infoMsg}
					schemas={this.props.schemas}
					filter={this.props.filter}/>
			</div>
		);
	}
}

export default SchemasPage;

