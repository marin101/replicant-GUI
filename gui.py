#!/usr/bin/env python2.7
# coding=utf-8

from gevent import monkey
monkey.patch_all()

from flask import Flask, Response, render_template, request, stream_with_context, g

from gevent.pywsgi import WSGIServer

from datetime import datetime

import sqlite3
import uuid
import time
import json
import yaml
import sys
import os

from util import Replicant

# TODO: This ip address is broadcast
IP_ADDRESS = "0.0.0.0"
PORT = 5000

def unicode_representer(dumper, uni):
    node = yaml.ScalarNode(tag=u'tag:yaml.org,2002:str', value=uni, style='"')
    return node

yaml.add_representer(unicode, unicode_representer)

GUI_REFRESH_PERIOD_SEC = 0.5
DATABASE = os.path.join(Replicant.REPLICANT_HOME, "data", "stats.db")

USERS_DIRECTORY = os.path.join(Replicant.REPLICANT_HOME, "gui", "users")

DEFAULT_CONFIG_FILENAME = os.path.join(Replicant.REPLICANT_HOME, "conf", "default.yml")
CONFIG_FILENAME = os.path.join(Replicant.REPLICANT_HOME, "gui", "users", "config.yml")

SCHEMAS_FILENAME = os.path.join(Replicant.REPLICANT_HOME, "gui", "users", "schemas.yml")

replicant = Replicant(CONFIG_FILENAME)

app = Flask(__name__)
app.debug = False

def init_database(database_path):
    def make_dicts(cursor, row):
        return dict((cursor.description[i][0], col) for i, col in enumerate(row))

    createReplicantMetadataTableSQL = (
        "CREATE TABLE IF NOT EXISTS replicant_metadata("
        + "replicant_id INTEGER PRIMARY KEY, "

        + "start_time_utc DATETIME default CURRENT_TIMESTAMP, "
        + "initial_load_finish_time_utc DATETIME, "
        + "stop_time_utc DATETIME, "

        + "total_initial_size_bytes default 0, "
        + "total_initial_size_rows default 0, "

        + "source_database_name VARCHAR(20) NOT NULL, "
        + "destination_database_name VARCHAR(20) NOT NULL, "

        + "timestamp_utc DATETIME default (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))"
      + ')')

    createReplicantTimeSeriesTableSQL = (
        "CREATE TABLE IF NOT EXISTS replicant_time_series("
        + "replicant_id INTEGER, "

        + "total_size_bytes BIGINT default 0, "
        + "total_size_rows BIGINT default 0, "

        + "created_table_cnt BIGINT default 0, "
        + "dropped_table_cnt BIGINT default 0, "

        + "total_rate_bytes_per_sec REAL default 0, "
        + "total_rate_rows_per_sec REAL default 0, "

        + "total_ETA_sec REAL default 'Inf', "

        + "timestamp_utc DATETIME default (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')), "

        + "FOREIGN KEY(replicant_id) REFERENCES replicant_metadata(replicant_id)"
      + ')')

    createTablesMetadataTableSQL = (
        "CREATE TABLE IF NOT EXISTS tables_metadata("
        + "table_id INTEGER PRIMARY KEY, "
        + "table_name VARCHAR(20) NOT NULL, "

        + "creation_time_utc DATETIME default CURRENT_TIMESTAMP, "

        + "initial_size_estimate_bytes BIGINT NOT NULL, "
        + "initial_size_estimate_rows BIGINT NOT NULL, "

        + "initial_size_bytes BIGINT NOT NULL, "
        + "initial_size_rows BIGINT NOT NULL, "

        + "loaded_time_utc DATETIME, "
        + "dropped_time_utc DATETIME, "

        + "timestamp_utc DATETIME default (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))"
      + ')')

    createTablesTimeSeriesTableSQL = (
        "CREATE TABLE IF NOT EXISTS table_time_series("
        + "table_name VARCHAR(20) NOT NULL, "

        + "size_bytes BIGINT default 0, "
        + "size_rows BIGINT default 0, "

        + "inserted_rows_cnt BIGINT default 0, "
        + "updated_rows_cnt BIGINT default 0, "
        + "deleted_rows_cnt BIGINT default 0, "

        + "truncate_operation_cnt BIGINT default 0, "

        + "rate_bytes_per_sec REAL default 0, "
        + "rate_rows_per_sec REAL default 0, "

        + "ETA_sec REAL default 'Inf', "

        + "timestamp_utc DATETIME default (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')), "

        + "FOREIGN KEY(table_name) REFERENCES tables_metadata(table_name)"
      + ')')

    ddls = [
        createReplicantMetadataTableSQL,
        createReplicantTimeSeriesTableSQL,
        createTablesMetadataTableSQL,
        createTablesTimeSeriesTableSQL,
    ]

    database = g.database = sqlite3.connect(database_path)
    database.row_factory = make_dicts

    for ddl in ddls:
        database.execute(ddl)
    database.commit()

    return database

def clear_database(database):
    database.execute("DELETE FROM replicant_metadata")
    database.execute("DELETE FROM tables_metadata")

    database.execute("VACUUM")

def database_connect(database_path):
    database = getattr(g, "database", None)

    if database is None:
        database = init_database(database_path)

    return database

@app.teardown_appcontext
def database_disconnect(exception):
    database = getattr(g, "database", None)

    if database is not None:
        database.close()

    if exception != None:
        return exception

def change_occurred(database, table, timestamp_utc):
    sql = "SELECT * FROM {} WHERE timestamp_utc >= '{}'"
    new_metadata = database.execute(sql.format(table, timestamp_utc))

    if next(new_metadata, None) is None:
        return False

    return True

def get_replicant_metadata(timestamp_utc):
    database = database_connect(DATABASE)

    if not change_occurred(database, "replicant_metadata", timestamp_utc):
        return []

    sql = "SELECT * FROM "          \
          + "replicant_metadata "   \
        + "ORDER BY "               \
          + "replicant_id"

    return database.execute(sql.format(timestamp_utc)).fetchall()

def get_tables_metadata(timestamp_utc):
    database = database_connect(DATABASE)

    if not change_occurred(database, "tables_metadata", timestamp_utc):
        return []

    sql = "SELECT * FROM "          \
          + "tables_metadata "      \
        + "ORDER BY "               \
          + "table_name"

    return database.execute(sql.format(timestamp_utc)).fetchall()

def get_replicant_time_series(timestamp_utc):
    database = database_connect(DATABASE)

    # TODO: Replace table_name with table_id
    # TODO: Add fetching all changes for GUI time series
    sql = "SELECT * FROM "           \
          + "replicant_time_series " \
        + "WHERE "                   \
          + "timestamp_utc > '{}' "  \
        + "ORDER BY "                \
          + "timestamp_utc DESC, "   \
          + "replicant_id DESC"

    new_time_series = database.execute(sql.format(timestamp_utc)).fetchall()

    # JSON doesn't support Infinity real value
    for i, sample in enumerate(new_time_series):
        if sample["total_ETA_sec"] == float("Inf"):
            new_time_series[i]["total_ETA_sec"] = "Infinity"

    return new_time_series

def get_table_time_series(timestamp_utc):
    database = database_connect(DATABASE)
    # TODO: make use of table_id not table_name
    sql = "SELECT * FROM "          \
          + "table_time_series "    \
        + "WHERE "                  \
          + "timestamp_utc > '{}' " \
        + "ORDER BY "               \
          + "timestamp_utc DESC, "  \
          + "table_name DESC"

    new_time_series = database.execute(sql.format(timestamp_utc)).fetchall()

    # JSON doesn't support Infinity real value
    for i, sample in enumerate(new_time_series):
        if sample["ETA_sec"] == float("Inf"):
            new_time_series[i]["ETA_sec"] = "Infinity"

    return new_time_series

@app.route("/data_stream/", methods=["GET"])
def data_stream():
    def stream():
        prev_timestamp_utc = 0

        replicant_metadata_event = "event: replicant_metadata\ndata: {}\n\n"
        replicant_time_series_event = "event: replicant_time_series\ndata: {}\n\n"

        tables_metadata_event = "event: tables_metadata\ndata: {}\n\n"
        table_time_series_event = "event: table_time_series\ndata: {}\n\n"

        while True:
            try:
                timestamp_utc = datetime.utcnow()

                tables_metadata = get_tables_metadata(prev_timestamp_utc)
                table_time_series = get_table_time_series(prev_timestamp_utc)

                replicant_metadata = get_replicant_metadata(prev_timestamp_utc)
                replicant_time_series = get_replicant_time_series(prev_timestamp_utc)

                prev_timestamp_utc = timestamp_utc
            except sqlite3.OperationalError as e:
                # TODO: Yield error, to be handled by the error listener
                yield str(e)
                return

            if replicant_metadata:
                yield replicant_metadata_event.format(json.dumps(replicant_metadata))

            if tables_metadata:
                yield tables_metadata_event.format(json.dumps(tables_metadata))

            if replicant_time_series:
                yield replicant_time_series_event.format(json.dumps(replicant_time_series))

            if table_time_series:
                yield table_time_series_event.format(json.dumps(table_time_series))

            time.sleep(GUI_REFRESH_PERIOD_SEC)

    return Response(stream_with_context(stream()), mimetype="text/event-stream")

@app.route("/fetch_default_configs/", methods=["GET"])
def fetch_default_config():
    try:
        with open(DEFAULT_CONFIG_FILENAME, 'r') as default_config_file:
            default_config = yaml.safe_load(default_config_file)
    except IOError:
        default_config = {}

    return json.dumps({"default_configs": default_config})

@app.route("/generate_schemas/", methods=["POST"])
def generate_schemas_file():
    config = json.loads(request.form.get("config", json.dumps(None)))

    if config is not None:
        try:
            with open(CONFIG_FILENAME, 'w') as config_file:
                yaml.dump(config, config_file, allow_unicode=True, default_flow_style=False)
        except IOError:
            return {"error": {
                "title": "Server could not write to schemas file",
                "body":  "Schemas file was not generated. Please, "
                         "make sure you have read access on the server."
            }}

    error_code = replicant.generate_schemas(CONFIG_FILENAME, SCHEMAS_FILENAME)

    response = {}
    if error_code != 0:
        response["error"] = {
            "title": "Replicant could not generate schemas file",
            "body":  "Replicant returned exit status: " + str(error_code) + ". "
                     "Either, make sure you have defined valid configuration and "
                     "try generating schemas again or select your own schemas."
        }
    else:
        try:
            with open(SCHEMAS_FILENAME, 'r') as schemas_file:
                response["schemas"] = yaml.safe_load(schemas_file)
        except IOError:
            response["error"] = {
                "title": "Server could not read from schemas file",
                "body":  "Schemas file was generated but not uploaded. "
                         "Please, make sure you have read access on the server."
            }

    return json.dumps(response)

@app.route("/replicant_start/", methods=["POST"])
def start_replication():
    snapshot_load = json.loads(request.form.get("snapshotLoad", json.dumps(False)))
    schemas = json.loads(request.form.get("schemas", json.dumps(None)))
    config = json.loads(request.form.get("config", json.dumps(None)))

    response = {}

    # Generate config file if config was given
    if config is not None:
        try:
            with open(CONFIG_FILENAME, 'w') as config_file:
                yaml.dump(config, config_file, allow_unicode=True, default_flow_style=False)
        except IOError:
            response["error"] = {
                "title": "Server could not write to config file",
                "body":  "Config file was not generated. Please, "
                         "make sure you have read access on the server."
            }

    if schemas is not None:
        try:
            with open(SCHEMAS_FILENAME, 'w') as schemas_file:
                yaml.dump(schemas, schemas_file, allow_unicode=True, default_flow_style=False)
        except IOError as e:
            response["error"] = {
                "title": "Server could not write to schemas file",
                "body":  "Schemas file was not generated. Please, "
                         "make sure you have read access on the server."
            }

    if response.get("error", None) is None:
        if schemas is None:
            replicant.set_schemas(None)
        else:
            replicant.set_schemas(SCHEMAS_FILENAME)

        try:
            # TODO: Remove when recovery is supported
            os.remove(replicant.RECOVERY_BIN)
        except OSError:
            pass

        clear_database(database_connect(DATABASE))
        replicant.start(snapshot_load)

    return json.dumps(response)

@app.route("/replicant_stop/", methods=["GET"])
def stop_replicant():
    # TODO: Unused at this moment
    replicant_id = json.loads(request.form.get("replicant_id", json.dumps(None)))

    replicant.terminate(False)

    #TODO: Maybe json.dumps({})
    return json.dumps("Replicant stopped")

@app.route('/', defaults={"path": ''})
@app.route("/<path:path>/")
def index(path):
    return render_template("index.html")


if __name__ == "__main__":
    try:
        os.mkdir(USERS_DIRECTORY)
    except:
        pass

#    app.run(debug = True, threaded = True)

# Use this in production code
    HTTPServer = WSGIServer((IP_ADDRESS, PORT), app) #, keyfile="server.key", certfile="server.crt")
    HTTPServer.serve_forever()

