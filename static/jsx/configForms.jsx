import React from 'react';

const SOURCE      = 1;
const DESTINATION = 2;

function InputBox(props) {
	const handleChange = event => {
		const input = event.target;

        props.onChange(
            props.configId,
            props.paramGroup,
            props.parameter.index,
            (input.type == "number") ? Number(input.value) : input.value
        );
	};

	const inputBoxId = props.configId + String(props.parameter.index);

	return (
		<div className="form-group row">
			<div className="col-md-4 col-form-label" style={{"marginTop": "5px"}}>
				<label htmlFor={inputBoxId}> {props.parameter.name} </label>
			</div>

			<div className="col-md-8">
                <input id={inputBoxId} className="form-control input-sm"
                    min={props.parameter.min_value} max={props.parameter.max_value}
                    type={props.parameter.type} onChange={handleChange}
                    value={props.parameter.value}/>
			</div>
		</div>
	);
}

// TODO: make sharable inputboxes for source and destination
// TODO: URL validation is not implemented
function ConfigForm(props) {
	if (props.config == null) return null;

	const connectionParamsList = (
		<div>
			{props.config.connectionParams.map((param, idx) =>
				<InputBox onChange={props.onChange} paramGroup="connectionParams"
                 parameter={Object.assign({}, param, {index: idx})}
				 configId={props.configId} key={param.id}/>
			)}
		</div>
	);

	const collapsibleLink = props.configId + "collapsible";
	const advancedParamsList = (props.config.advancedParams.length == 0) ? null : (
		<div className="panel panel-primary">
			<div className="panel-heading">
				<h4 className="panel-title">
					<a data-toggle="collapse" href={"#" + collapsibleLink}>
						Advanced options
					</a>
				</h4>
			</div>

			<div id={collapsibleLink} className="panel-collapse collapse panel-body">
				{props.config.advancedParams.map((param, idx) =>
					<InputBox onChange={props.onChange} paramGroup="advancedParams"
						parameter={Object.assign({}, param, {index: idx})}
						configId={props.configId} key={param.id}/>
				)}
			</div>
		</div>
	);

	/**
	<div className="form-group">
		<img src={"/static/images/" + props.config.image} alt=''
			style={{"width": "50%", "height": ""}}/>
	</div>
	 */
	return (
		<div>
			<div className="form-group">
				{connectionParamsList}
			</div>

			<div className="form-group">
				{advancedParamsList}
			</div>
		</div>
	);
}

function DatabaseList(props) {
	if (Object.getOwnPropertyNames(props.configs).length == 0) return null;

	return (
		<optgroup label={props.groupName}>
			{Object.keys(props.configs).sort((configName1, configName2) => {
				if (configName1.name < configName2.name) return -1;
				if (configName1.name > configName2.name) return  1;

				return 0;
			}).map(configId =>
				<option disabled={props.configs[configId].disabled || false}
					key={configId} value={configId}>
					{props.configs[configId].name}
				</option>
			)}
		</optgroup>
	);
}

function DatabaseMenu(props) {
	const handleChange = event => {props.onChange(event.target.value)};

	let formName, defaultOptionStr, defaultConfigs;
	if (props.type == SOURCE) {
		defaultOptionStr = "-- select source database --";
		formName="Source databases";
	} else {
		defaultOptionStr = "-- select destination database --";
		formName="Destination databases";
	}

	return (
		<div className="form-group">
			<select required id={props.type} className="form-control"
				value={props.configId} onChange={handleChange}>

				<option disabled hidden value=''> {defaultOptionStr} </option>

				<DatabaseList configs={props.configs} groupName={formName}/>
			</select>
		</div>
	);
}

function SourceDatabaseMenu(props) {
	return <DatabaseMenu type={SOURCE} {...props}/>
}

function DestinationDatabaseMenu(props) {
	return <DatabaseMenu type={DESTINATION} {...props}/>
}

function SourceConfigForm(props) {
	return <ConfigForm type={SOURCE} {...props}/>
}

function DestinationConfigForm(props) {
	return <ConfigForm type={DESTINATION} {...props}/>
}

export {
	SourceDatabaseMenu, DestinationDatabaseMenu,
	SourceConfigForm, DestinationConfigForm
};

