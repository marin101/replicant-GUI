#!/usr/bin/env python2
# coding=utf-8

import subprocess
import atexit
import time
import os

class COLORS(object):
    DEFAULT = "\033[39m"
    VIOLET = "\033[95m"
    GREEN = "\033[92m"
    BLUE = "\033[94m"
    RED = "\033[91m"

    END = "\033[0m"


class BG_COLORS(object):
    DEFAULT = "\033[49m"
    BLACK = "\033[40m"
    RED = "\033[41m"
    GREEN = "\033[42m"

    LIGHT_RED = "\033[101m"
    LIGHT_GREEN = "\033[102m"


def colored(string, color="", bg_color=""):
    return color + bg_color + string + COLORS.DEFAULT + BG_COLORS.DEFAULT

def equal_floats(x, y, precision=6):
    if abs(x - y) > 10**(-precision):
        return False

    return True


class Replicant(object):

    REPLICANT_HOME = os.environ["REPLICANT_HOME"]
    FILENAME = os.path.join(REPLICANT_HOME, "bin", "replicant")
    DEBUG_LOG = os.path.join(REPLICANT_HOME, "data", "debug.log")
    ERROR_LOG = os.path.join(REPLICANT_HOME, "data", "error.log")
    RECOVERY_BIN = os.path.join(REPLICANT_HOME, "data", "recovery.bin")

    def __init__(self, conf_filename, schemas=None):
        self.conf_filename = os.path.abspath(conf_filename)

        self.snapshot_load = False
        self.replicant_proc = None
        self.returncode = None
        self.schemas = schemas

        self._debug_log_pos = 0

    # Waits for n ocurrences of the lines with str_val and without the without
    def _wait_string(self, str_val, timeout_sec,  without="qo827ugf98gfb", n=1):
        if n <= 0:
            return True

        start_time_sec = time.time()

        # wait until debug log is created
        while time.time() - start_time_sec < timeout_sec:
            if os.path.isfile(Replicant.DEBUG_LOG):
                break

            time.sleep(.5)
        else:
            return False

        #TODO: Consider keeping file open all the time instead of reopening
        with open(Replicant.DEBUG_LOG, 'r') as log:
            log.seek(self._debug_log_pos)
            ocurrence = 0

            while time.time() - start_time_sec < timeout_sec:
                new_line = log.readline()

                if not new_line:
                    time.sleep(1.0)
                    continue

                if str_val in new_line and without not in new_line:
                    self._debug_log_pos = log.tell()
                    ocurrence += 1

                    if ocurrence >= n:
                        return True

            self._debug_log_pos = log.tell()

        return False

    def set_schemas(self, schemas):
        self.schemas = schemas

    def generate_schemas(self, conf_filename=None, dest_path=None):
        if conf_filename is None:
            conf_filename = self.conf_filename

        target = ["--target-file", dest_path] if dest_path is not None else []
        params = [Replicant.FILENAME, "gen-schemas", conf_filename] + target

        # Start replication process
        with open(os.devnull, 'w') as devnull, open(Replicant.ERROR_LOG , 'w') as log:
            try:
                subprocess.check_call(params, stdout=devnull, stderr=log)
            except subprocess.CalledProcessError as e:
                return 1

        return 0

    def is_running(self):
        # query OS to see if another replicant process is running
        return self.replicant_proc is not None and self.replicant_proc.poll() is None

    # Starts/restarts replication process
    def start(self, snapshot_load=False):
        # Restart replicant process if it exists
        if self.replicant_proc is not None and self.replicant_proc.poll() is None:
            self.terminate()

        self.snapshot_load = snapshot_load
        self.returncode = None

        self._debug_log_pos = 0

        params = filter(lambda x: x != '', [
            Replicant.FILENAME,
            "snapshot" if snapshot_load else "full",
            self.conf_filename,
            self.schemas if self.schemas is not None else ''
        ])

        # Start replication process
        with open(os.devnull, 'w') as devnull, open(Replicant.ERROR_LOG , 'w') as log:
            self.replicant_proc = subprocess.Popen(params, stdout=devnull, stderr=log)

        # TODO: Garbage collector won't cleanup until interpreter exits
        atexit.register(self.terminate)
        return self

    # Terminates replicant process
    def terminate(self, termination_delay=False):
        # Process was never started
        if self.replicant_proc is None:
            return

        # Check if replicant was already terminated
        if self.snapshot_load and self.returncode is not None:
            return

        # To be sure last operation was successful
        if termination_delay:
            self.wait_commit(5)

        try:
            self.replicant_proc.terminate()
        except (OSError):
            # Process is already dead
            pass

    # Wait for n AS OF SCN lines in the debug.log
    def wait_scn(self, n, timeout_sec=90):
        # String is encountered twice for every table
        return self._wait_string("AS OF SCN", timeout_sec, n=2*n)

    # Wait for n AS OF SCN lines in the debug.log
    def wait_commit(self, timeout_sec=20):
        return self._wait_string("Commited", timeout_sec)

    # Waits for operation to be processed, returns true if operation executed
    def wait_operation(self, n=1, timeout_sec=90):
        if not self._wait_string("Processing: oper = ", timeout_sec, "Commit", n):
            return False

        self.returncode = 0
        return True

    # Wait for process to terminate or to start real time replication
    def wait_init_load(self, timeout_sec=90):

        if self.returncode is not None:
            return self.returncode

        # Process has terminated prematurely
        # TODO: Think about this solution, returncode is misleading
        if self.replicant_proc.poll() is not None:
            self.returncode = 2
            return self.returncode

        if self.snapshot_load:
            self.replicant_proc.wait()
            self.returncode = self.replicant_proc.returncode
        else:
            mode_msg = "Real-time replication started"
            msg_found = self._wait_string(mode_msg, timeout_sec)

            self.returncode = 0 if msg_found else 1

        return self.returncode

