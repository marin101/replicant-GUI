import {toHHMMSS, prettyNumber} from "./util.js";
import React from "react";

import {bindActionCreators} from "redux";
import {connect} from "react-redux";

import {BootstrapTable, TableHeaderColumn} from "react-bootstrap-table";
import "react-bootstrap-table/dist/react-bootstrap-table-all.min.css";

const KILO = 1000;
const MEGA = 1000 * KILO;
const GIGA = 1000 * MEGA;

class SideBar extends React.Component {
	constructor() {
		super();

		this.goToConfigPage = this.goToConfigPage.bind(this);
		this.handleReplicantStop = this.handleReplicantStop.bind(this);
		this.handleNewReplication = this.handleNewReplication.bind(this);
	}

	goToConfigPage() {
		this.props.resetConfigs();
		this.props.resetSchemas();

		this.props.push("/config/");
	}

	handleNewReplication(event) {
		event.preventDefault();

		const msg = "Starting new replication will stop the current replication!";

        if (!this.props.replicantRunning) {
			this.goToConfigPage();
		} else if (confirm(msg)) {
			this.handleReplicantStop(event);
			this.goToConfigPage();
        }
	}

	handleReplicantStop(event) {
		event.preventDefault();

        if (this.props.replicantRunning) {
            // TODO: Add error panel on get request error
            const stopReplicationRequest = new XMLHttpRequest();

            stopReplicationRequest.addEventListener("load", message => {
                this.props.setReplicantRunning(false);
            });

            stopReplicationRequest.open("GET", "/replicant_stop/");
            stopReplicationRequest.send();
        }
	}

	render() {
		return (
			<div className="col-md-2 sidebar">
				<ul className="nav nav-sidebar">
					<li className="active">
						<a href=''>
							Replication statistics

							<span className="sr-only">
								(current)
							</span>
						</a>
					</li>

					<li className="">
						<a href='' onClick={this.handleReplicantStop}>
							Stop replication

							<span className="sr-only">
								(current)
							</span>
						</a>
					</li>

					<li className="">
						<a href='' onClick={this.handleNewReplication}>
							Start new replication

							<span className="sr-only">
								(current)
							</span>
						</a>
					</li>
				</ul>
			</div>
		);
	}
}

class ReplicationTable extends React.Component {
	constructor() {
		super();

		this.rowFormatter = this.rowFormatter.bind(this);
	}

	rateFormatter(maxRate, rate) {
		let unit;

		if (this.props.replicationFinished) {
			unit = "  B/s";
			rate = 0;
		} else if (rate < KILO) {
			unit = "  B/s";
		} else if (rate < MEGA) {
			maxRate /= 1000;
			rate /= 1000;

			unit = " KB/s";
		} else if (rate < GIGA) {
			maxRate /= 1000 * 1000;
			rate /= 1000 * 1000;

			unit = " MB/s";
		} else {
			maxRate /= 1000 * 1000 * 1000;
			rate /= 1000 * 1000 * 1000;

			unit = " GB/s";
		}

		return (
			<div className="progress">
				<div className="progress-bar" role="progressbar"
					aria-valuenow={rate} aria-valuemin="0" aria-valuemax="100"
					style={{"width": ((maxRate > 0) ? 100 * rate/maxRate : 0) + '%'}}>
					<span>{prettyNumber(rate.toFixed(2))} {unit}</span>
				</div>
			</div>
		)
	}

	progressFormatter(cell, row) {
		let progress = 0;

		if ((row.loaded_time_utc == null) ? false : true) {
			progress = 100;
		} else if (row.size_rows > row.initial_size_rows) {
			progress = 99.90;
		} else if (row.initial_size_rows === 0) {
			progress = 0;
		} else {
			progress = 100 * row.size_rows / row.initial_size_rows;
		}

		return (
			<div className="progress">
				<div className="progress-bar" role="progressbar"
					aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100"
					style={{"width": progress + '%'}}>
					<span>{prettyNumber(progress.toFixed(2))} %</span>
				</div>
			</div>
		);
	}

	ETAFormatter(cell) {
		return toHHMMSS(cell);
	}

	rowFormatter(row) {
		if (row.dropped_time_utc != null) {
			return "danger";
		}

		if (!this.props.initLoadFinished && row.loaded_time_utc != null) {
			return "success";
		}

		return '';
	}

	rowsCntFormatter(rows) {
		let uRows;
		let unit;

		if (rows < KILO) {
			uRows = rows;
			unit = "  ";
		} else if (rows < MEGA) {
			uRows = rows / 1000;
			unit = " K";
		} else if (rows < GIGA) {
			uRows = rows / (1000 * 1000);
			unit = " M";
		} else {
			uRows = rows / (1000 * 1000 * 1000);
			unit = " G";
		}

		return (
            <div data-toggle="tooltip" data-placement="bottom" title={rows + "  "}>
                {((unit == "  ") ? rows : prettyNumber(uRows.toFixed(2))) + unit}
            </div>
        );
	}

	sizeBytesFormatter(bytes) {
		let uBytes = bytes;
		let unit;

		if (bytes < KILO) {
			unit = "  B";
		} else if (bytes < MEGA) {
			uBytes = bytes / 1000;
			unit = " KB";
		} else if (bytes < GIGA) {
			uBytes = bytes / (1000 * 1000);
			unit = " MB";
		} else {
			uBytes = bytes / (1000 * 1000 * 1000);
			unit = " GB";
		}

		return (
            <div data-toggle="tooltip" data-placement="bottom" title={bytes + " B"}>
                {((unit == "  B") ? bytes : prettyNumber(uBytes.toFixed(2))) + unit}
            </div>
        );
	}

	// TODO: maybe add something like thead-inverse to color table head
	render() {
		let maxRate = 0;
		for (var tableInfo of this.props.tablesInfo) {
			maxRate = Math.max(maxRate, tableInfo.rate_bytes_per_sec);
		}

		const options =	{
			defaultSortOrder: "asc",
			defaultSortName: "table_name"
		}

		let customTableColumns = [];
		if (!this.props.initLoadFinished) {
			customTableColumns = [
				<TableHeaderColumn dataSort dataAlign="center"
					key="progress" dataFormat={this.progressFormatter}>
					Progress
				</TableHeaderColumn>
			,
				<TableHeaderColumn dataSort dataAlign="center"
					key="ETA" dataFormat={this.ETAFormatter}
					dataField="ETA_sec">
					ETA(HH:MM:SS)
				</TableHeaderColumn>
			];
		} else {
			customTableColumns = [
				<TableHeaderColumn dataSort dataAlign="right" dataField="inserted_rows_cnt"
					key="insert" dataFormat={this.rowsCntFormatter}>
					Inserted rows
				</TableHeaderColumn>
			,
				<TableHeaderColumn dataSort dataAlign="right" dataField="deleted_rows_cnt"
					key="delete" dataFormat={this.rowsCntFormatter}>
					Deleted rows
				</TableHeaderColumn>
			,
				<TableHeaderColumn dataSort dataAlign="right" dataField="updated_rows_cnt"
					key="update" dataFormat={this.rowsCntFormatter}>
					Updated rows
				</TableHeaderColumn>
			];
		}

		return (
			<BootstrapTable data={this.props.tablesInfo} condensed striped hover options={options}
				trClassName={this.rowFormatter}>
				<TableHeaderColumn isKey dataSort dataField="table_name">
					Table name
				</TableHeaderColumn>

				<TableHeaderColumn dataSort dataAlign="right" dataField="size_rows"
					dataFormat={this.rowsCntFormatter}>
					Rows count
				</TableHeaderColumn>

				<TableHeaderColumn dataSort dataAlign="right" dataField="size_bytes"
					dataFormat={this.sizeBytesFormatter}>
					Size
				</TableHeaderColumn>

				{customTableColumns.map(column => {return column;})}

				<TableHeaderColumn dataSort dataAlign="center" dataField="rate_bytes_per_sec"
					dataFormat={this.rateFormatter.bind(this, maxRate)}>
					Transfer rate
				</TableHeaderColumn>

			</BootstrapTable>
		);
	}
}

class ElapsedTimeClock extends React.Component{
	constructor() {
		super();

		this.state = {
			startTimeMillis: null,
			elapsedTimeSec: 0
		};
	}

	clearTimer() {
		if (this.timerID != null) {
			clearInterval(this.timerID);
			this.timerID = undefined;
		}
	}

	componentWillUnmount() {
		this.clearTimer();
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.startTimeUTC != this.props.startTimeUTC) {
			this.clearTimer();

			this.timerID = setInterval(() => this.tick(), 1000);
			this.setState({startTimeMillis: toMillis(nextProps.startTimeUTC)});
		}

		if (nextProps.stopTimeUTC != null) {
			const stopTimeMillis = toMillis(nextProps.stopTimeUTC);

			this.setState({
				elapsedTimeSec: (stopTimeMillis - this.state.startTimeMillis) / 1000.
			});

			this.clearTimer();
		}
	}

	tick() {
		this.setState({
			elapsedTimeSec: ((new Date()).getTime() - this.state.startTimeMillis) / 1000.
		});
	}

	render() {
		if (this.state.startTimeMillis == null) {
			return (
				<div> Elapsed time(HH:MM:SS): 00:00:00 </div>
			);
		}

		return (
			<div> Elapsed time(HH:MM:SS): {toHHMMSS(this.state.elapsedTimeSec)} </div>
		);
	}
}

function ReplicationOverall(props) {
	const totalETA = toHHMMSS(props.replicantInfo.total_ETA_sec);

	let totalRate = props.replicantInfo.total_rate_bytes_per_sec;
	if (totalRate == null) totalRate= 0;

	const sizeRows = props.replicantInfo.total_size_rows;
	const initSizeRows = props.replicantInfo.total_initial_size_rows;
	let rateLimit = Math.pow(10, Math.ceil(Math.log10(totalRate)));

	let progress;
   	if ((props.replicantInfo.initial_load_finish_time_utc == null) ? false : true) {
		progress = 100;
	} else if (sizeRows > initSizeRows) {
		progress = 99.90;
	} else if (initSizeRows == 0) {
		progress = 0;
	} else {
		progress = 100 * sizeRows / initSizeRows;
	}

	let rateUnit;
	if (totalRate < KILO) {
		rateUnit = " B/s";
	} else if (totalRate < MEGA) {
		rateUnit = "KB/s";

		totalRate /= 1000;
		rateLimit /= 1000;
	} else if (totalRate < GIGA) {
		rateUnit = "MB/s";

		totalRate /= 1000 * 1000;
		rateLimit /= 1000 * 1000;
	} else {
		rateUnit = "GB/s";

		totalRate /= 1000 * 1000 * 1000;
		rateLimit /= 1000 * 1000 * 1000;
	}

	if (props.replicantInfo.stop_time_utc != null) {
		totalRate = 0;
	}

	// TODO: This calculation is unnecesarry and CPU consuming. Remove it!!!
	const startTimeMillis = toMillis(props.replicantInfo.start_time_utc);
	const initLoadTimeMillis = toMillis(props.replicantInfo.initial_load_finish_time_utc);

	return (
		<div style={{"paddingBottom": "10px"}}>
			{!props.initLoadFinished &&
				<div style={{"paddingBottom": "10px"}}>
					<div>
						<span className="align-left">
							<em>Total progress</em>
						</span>
						<span className="align-right">
							<em>ETA(HH:MM:SS): {totalETA}</em>
						</span>

						<div className="clear"></div>
					</div>

					<div className="progress">
						<div className="progress-bar" role="progressbar" aria-valuemin="0"
							aria-valuenow={progress.toFixed(2)} aria-valuemax="100"
							style={{"width": progress.toFixed(2) + '%'}}>

							<span>{progress.toFixed(2)} %</span>
						</div>
					</div>
				</div>
			}

			<em>Total transfer rate</em>
			<div className="progress">
				<div className="progress-bar" role="progressbar" aria-valuemin="0"
					aria-valuenow={totalRate.toFixed(2)}  aria-valuemax="100"
					style={{"width": ((rateLimit > 0) ? 100 * totalRate/rateLimit : 0) + '%'}}>
					  <span>{prettyNumber(totalRate.toFixed(2))} {rateUnit}</span>
				</div>
			</div>
			<div style={{"paddingBottom": "10px"}}>
				<span className="align-left">
					<em>0 {rateUnit}</em>
				</span>
				<span className="align-right">
					<em>{prettyNumber(rateLimit)} {rateUnit}</em>
				</span>

				<div className="clear"></div>
			</div>

			<div>
				<span className="align-left">
					<ElapsedTimeClock startTimeUTC={props.replicantInfo.start_time_utc}
						stopTimeUTC={props.replicantInfo.stop_time_utc}/>
				</span>
				{initLoadTimeMillis != null &&
					<span className="align-right">
						<b>Initial load time</b>(HH:MM:SS):
							{toHHMMSS((initLoadTimeMillis - startTimeMillis) / 1000.)}
					</span>
				}

				<div className="clear"></div>
			</div>
		</div>
	);
}

function toMillis(timestamp) {
	let r = /^\s*(\d{4})-(\d\d)-(\d\d)\s+(\d\d):(\d\d):(\d\d)(\.(\d{3}))?\s*$/
	let m = (""+timestamp).match(r);

	if (m != null && m[7] == null) m[7] = 0;
	return (m) ? Date.UTC(m[1], m[2]-1, m[3], m[4], m[5], m[6], m[7]) : undefined;
};

function ReplicationTitle(props) {
	return (
		<h3 className="page-header"
			style={{"display": "flex", "marginTop": "0", "paddingBottom": "0"}}>

			<span style={{"flex": "1"}}>
				{props.srcDbName}
			</span>

			<span className="text-center" style={{"flex": "1"}}> &rArr; </span>

			<span className="text-right" style={{"flex": "1"}}>
				{props.destDbName}
			</span>
		</h3>
	);
}

class DashboardBody extends React.Component {
	constructor() {
		super();

		this.state = {
			replicantsMetadata: [],
			replicantsStatus: [{}],

			tablesMetadata: [],
			tablesStatus: []
		}
	}

	componentDidMount() {
		this.SSEStream = new EventSource("/data_stream/");

		/* TODO: Add security check for event listener
		if (msg.origin != "http://127.0.0.1:5000") {
			alert("Message did not originate from trusted source");
		} */
		this.SSEStream.addEventListener("open", message => {
			this.setState({errorOccurred: false});
		});

		this.SSEStream.addEventListener("error", error => {
			this.setState({errorOccurred: true});
		});

		this.SSEStream.addEventListener("replicant_metadata", message => {
            const replicantsMetadata = JSON.parse(message.data);

            this.props.setReplicantRunning(replicantsMetadata[0].stop_time_utc == null);
			this.setState({replicantsMetadata: replicantsMetadata});
		});

		this.SSEStream.addEventListener("tables_metadata", message => {
			this.setState({ tablesMetadata: JSON.parse(message.data) });
		});

		this.SSEStream.addEventListener("replicant_time_series", message => {
			const replicantsStatuses = JSON.parse(message.data);
			const newReplicantsStatus = [replicantsStatuses[0]];

			const firstReplicantId = replicantsStatuses[0].replicant_id;

			/* Take only last sample of every table */
			/* Time series samples are sorted in reversed order by timestamp */
			for (let i = 1; i < replicantsStatuses.length; i++) {
				if (replicantsStatuses[i].replicant_id === firstReplicantId) break;

				newReplicantsStatus.push(replicantsStatuses[i]);
			}

			newReplicantsStatus.sort((x, y) => {
				if (x.replicant_id < y.replicant_id) return -1;
				if (x.replicant_id > y.replicant_id) return  1;

				return 0;
			});


			this.setState({ replicantsStatus: newReplicantsStatus });
		});

		this.SSEStream.addEventListener("table_time_series", message => {
			const tablesStatuses = JSON.parse(message.data);
			const firstTableName = tablesStatuses[0].table_name;

			const newTablesStatus = [tablesStatuses[0]];

			/* Take only last sample of every table */
			/* Time series samples are sorted in reversed order by timestamp */
			for (let i = 1; i < tablesStatuses.length; i++) {
				if (tablesStatuses[i].table_name === firstTableName) break;

				newTablesStatus.push(tablesStatuses[i]);
			}

			newTablesStatus.sort((x, y) => {
				if (x.table_name < y.table_name) return -1;
				if (x.table_name > y.table_name) return  1;

				return 0;
			});

			this.setState({ tablesStatus: newTablesStatus });
		});

		// Close SSE connection on page unload
		window.addEventListener("unload", () => {
			this.SSEStream.close();
		});
	}

	// Close SSE connection on component unmount
	componentWillUnmount() {
		this.SSEStream.close();
	}

	render() {
		// TODO: Add real replicant ID handling, not 0
		const replicantMetadata = this.state.replicantsMetadata[0];
		const replicantStatus = this.state.replicantsStatus[0];

		const tablesMetadata = this.state.tablesMetadata;
		const tablesStatus = this.state.tablesStatus;

		const replicantInfo = Object.assign({}, replicantMetadata, replicantStatus);
		const initLoadFinished = replicantInfo.initial_load_finish_time_utc != null &&
                                 !this.props.snapshotLoad;

		let tablesInfo = [];
		// TODO: This for loop might be unnecessary because arrays are sorted
		for (let i = 0, j = 0; i < tablesMetadata.length && j < tablesStatus.length;) {
			if (tablesMetadata[i].table_name === tablesStatus[j].table_name) {
				tablesInfo.push(Object.assign({}, tablesMetadata[i++], tablesStatus[j++]));
			} else if (tablesMetadata[i].table_name < tablesStatus[j].table_name) {
				i++;
			} else {
				j++;
			}
		}

        //TODO: Last table gets deleted instantly instead of waiting because of this
        if (replicantStatus.created_table_cnt <= replicantStatus.dropped_table_cnt) {
            tablesInfo = [];
        }

		let errorMessagePanel;
		if (this.state.errorOccurred) {
			errorMessagePanel = (
				<div className="panel panel-danger">
					<div className="panel-heading">
						<h3 className="panel-title">No server connection</h3>
					</div>
					<div className="panel-body">
						Connection to the server was dropped.
					</div>
				</div>
			);
		}

		return (
			<div className="col-md-10 col-md-offset-2 dashboard">
				<ReplicationTitle
					srcDbName={replicantInfo.source_database_name}
					destDbName={replicantInfo.destination_database_name}
				/>

				{errorMessagePanel}

				<ReplicationOverall replicantInfo={replicantInfo}
					initLoadFinished={initLoadFinished}/>
				<ReplicationTable replicationFinished={replicantInfo.stop_time_utc != null}
					initLoadFinished={initLoadFinished} tablesInfo={tablesInfo}/>
			</div>
		);
	}
}

class DashboardPage extends React.Component {
	render() {
		return (
			<div className="row">
				<SideBar replicantRunning={this.props.replicantRunning}
					setReplicantRunning={this.props.setReplicantRunning}
					resetSchemas={this.props.resetSchemas}
					resetConfigs={this.props.resetConfigs}
					push={this.props.history.push}/>

				<DashboardBody setReplicantRunning={this.props.setReplicantRunning}/>
			</div>
		);
	}
}

export default DashboardPage;

