import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { requestAPI } from './handler';
import { ICommandPalette } from '@jupyterlab/apputils';
import { Notebook, NotebookActions, NotebookPanel } from '@jupyterlab/notebook';
import { ICodeCellModel, ICellModel, Cell, CodeCell } from '@jupyterlab/cells';

/**
 * Initialization data for the jupyter-fs extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-fs:plugin',
  description: 'A JupyterLab extension (fs aware).',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd) => {
    const { commands } = app;
    const command = 'Dependencies:get-fs';

    console.log('JupyterLab extension jupyter-fs is activated!');

    let cellToCommit = new Map<string, string>();
    let listenerAttached = false;

    async function makeCommit(
      c: Cell<ICodeCellModel>,
      cid: string,
      panel: NotebookPanel
    ) {
      try {
        // Make commit and get commit hash.
        const data = await requestAPI<any>('make-commit');
        console.log('data.hash: ', data);
        if (data.error) {
          console.log('data error: ', data.error);
        }
        cellToCommit.set(cid, data.hash);

        // Wait for cell to run.
        const notebook = panel.content as Notebook;
        await NotebookActions.runCells(notebook, [c], panel.sessionContext);
        console.log('finished running cell!');
      } catch (reason) {
        console.error(
          `The jupyter_fs server extension appears to be missing.\n${reason}`
        );
      }
    }

    async function setup(panel: NotebookPanel) {
      let cells = panel.content.widgets as Cell<ICellModel>[];
      if (cells && cells.length > 0) {
        for (const cell of cells) {
          if (cell && cell.model.type === 'code') {
            const codeCell = cell as Cell<ICodeCellModel>;
            const cid = codeCell.model.id;
            console.log('Running cell: ', cid);
            await makeCommit(codeCell, cid, panel);
          }
        }
      }
      console.log('hash map after setup: ', cellToCommit);
    }

    async function revert(hash: string) {
      console.log('reverting to hash: ', hash);
      const data = await requestAPI<any>(`make-revert?hash=${hash}`);
      console.log('data: ', data);
    }

    // Listen to when a cell is scheduled for execution; revert the state
    // of the FS when a cell is about to execute.
    let onScheduled = (nb: any, data: any) => {
      const c = data.cell;
      if (c && c instanceof CodeCell) {
        const cid = c.model.id;
        const hash = cellToCommit.get(cid);
        if (hash) {
          console.log(`cid's commit: ${cid}, ${hash}`);
          revert(hash);
        } else {
          throw new Error(`cannot find commit for code cell: ${cid}`);
        }
      }
    };

    commands.addCommand(command, {
      label: 'FS',
      caption: 'Reacting to FS changes.',
      execute: (args: any) => {
        console.log('begin fs extension');
        if (app && app.shell && app.shell.currentWidget) {
          const panel = app.shell.currentWidget as NotebookPanel;
          setup(panel);

          // Attach execution listener after set-up.
          if (!listenerAttached) {
            NotebookActions.executionScheduled.connect(onScheduled);
          }
        }
      }
    });

    requestAPI<any>('get-example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The jupyter_fs server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default plugin;
