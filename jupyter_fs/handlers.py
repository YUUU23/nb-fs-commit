import json
import subprocess, os

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado

class RouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /jupyter-fs/get-example endpoint!"
        }))
        
class RouteHandlerCommit(APIHandler):
    @tornado.web.authenticated
    def get(self):
        script_path = "./jupyter_fs/script/commit.sh"
        cur_dir = os.getcwd()
        result = subprocess.run(["bash", script_path], capture_output=True, text=True)
        self.write(json.dumps({
            "curdir": cur_dir, 
            "hash": result.stdout, 
            "error": result.stderr
        }))

class RouteHandlerRevert(APIHandler):
    @tornado.web.authenticated
    def get(self):
<<<<<<< HEAD
        script_path = "./jupyter_fs/script/revert.sh"
        hash = self.get_argument("hash")
        result = subprocess.run(["bash", script_path, hash], capture_output=True, text=True)
        self.write(json.dumps({
            "res": result.stdout,
            "error": result.stderr
=======
        script_path = ""
        hash = self.get_argument("hash")
        self.write(json.dumps({
            "curdir": "reverting", 
            "hash": hash, 
            "error": ""
>>>>>>> ec0939f7550f5f10a26b19b748825aa9b0a46634
        }))
        

def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "jupyter-fs", "get-example")
    route_pattern_commit = url_path_join(base_url, "jupyter-fs", "make-commit")
    route_pattern_revert = url_path_join(base_url, "jupyter-fs", "make-revert")
    handlers = [(route_pattern, RouteHandler), (route_pattern_commit, RouteHandlerCommit), (route_pattern_revert, RouteHandlerRevert)]
    web_app.add_handlers(host_pattern, handlers)
