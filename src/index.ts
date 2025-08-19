import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { requestAPI } from './handler';
import { ICommandPalette } from '@jupyterlab/apputils';
import {
  Notebook,
  NotebookActions,
  NotebookPanel,
  INotebookTracker
} from '@jupyterlab/notebook';
import { ICodeCellModel, ICellModel, Cell, CodeCell } from '@jupyterlab/cells';

/**
 * Initialization data for the jupyter-fs extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyter-fs:plugin',
  description: 'A JupyterLab extension (fs aware).',
  autoStart: true,
  requires: [ICommandPalette],
  activate: (app: JupyterFrontEnd, notebookTracker: INotebookTracker) => {
    const { commands } = app;
    const command = 'Dependencies:get-fs';

    console.log('JupyterLab extension jupyter-fs is activated!');

    let cellToCommit: Map<string, string> = new Map<string, string>();
    let listenerAttached: boolean = false;
    let activeCellId: string = '';
    let cellReverted: string = '';
    let panel: NotebookPanel;

    function getSubsequentCells(cid: string) {
      const notebook = panel.content;
      const model = notebook.model;
      if (model && model.cells) {
        const cells = model.cells;
        let activeCellIndex = -1;
        for (let i = 0; i < cells.length; i++) {
          const cellModel = cells.get(i);
          if (cellModel.id === cellReverted) {
            activeCellIndex = i;
            break;
          }
        }
        return notebook.widgets.slice(activeCellIndex + 1);
      }

      return [];
    }

    async function makeCommit(cid: string) {
      try {
        // Make commit and get commit hash.
        const data = await requestAPI<any>('make-commit');
        console.log('data after making commit: ', data);
        if (data.error) {
          console.log('data error: ', data.error);
        }
        cellToCommit.set(cid, data.hash);
      } catch (reason) {
        console.error(
          `The jupyter_fs server extension appears to be missing.\n${reason}`
        );
      }
    }

    async function makeCommitAndRunCells(cells: Cell<ICellModel>[]) {
      if (cells && cells.length > 0) {
        for (const cell of cells) {
          if (cell && cell.model.type === 'code') {
            const codeCell = cell as Cell<ICodeCellModel>;
            const cid = codeCell.model.id;
            console.log('Running cell: ', cid);
            await makeCommit(cid);

            // Wait for cell to run.
            const notebook = panel.content as Notebook;
            await NotebookActions.runCells(
              notebook,
              [codeCell],
              panel.sessionContext
            );
            console.log('finished running cell!');
          }
        }
      }
    }

    async function setup(panel: NotebookPanel) {
      let cells = panel.content.widgets as Cell<ICellModel>[];
      await makeCommitAndRunCells(cells);
      console.log('hash map after setup: ', cellToCommit);
    }

    async function revert(hash: string) {
      try {
        // Revert the FS State
        console.log('reverting to hash: ', hash);
        const data = await requestAPI<any>(`make-revert?hash=${hash}`);
        console.log('data for revert call: ', data);
      } catch (reason) {
        console.error(`Failed to make a revert.\n${hash}`);
      }
    }

    async function onExecuted(nb: any, data: any) {
      // Run all subsequent cells.
      let cell = data.cell;
      console.log(
        'cell executed: ',
        cell.model.id,
        'to revert: ',
        cellReverted
      );
      if (cell.model.id === cellReverted) {
        // Refresh commit for cell ran and all subsequent cells.
        await makeCommit(cellReverted);
        const subsequentCells = getSubsequentCells(cellReverted);
        await makeCommitAndRunCells(subsequentCells);

        cellReverted = '';
      }
    }

    function onScheduled(nb: any, data: any) {
      // Listen to when a cell is scheduled for execution; revert the state
      // of the FS when a cell is about to execute.
      const c = data.cell;
      console.log(activeCellId);
      if (
        c &&
        c instanceof CodeCell &&
        c.model.id == activeCellId &&
        cellReverted == ''
      ) {
        const cid = c.model.id;
        const hash = cellToCommit.get(cid);
        if (hash) {
          console.log(`cid's commit: ${cid}, ${hash}`);
          revert(hash);
          cellReverted = activeCellId;
          activeCellId = '';
        } else {
          throw new Error(`cannot find commit for code cell: ${cid}`);
        }
      }
    }

    function attachListeners() {
      // Attach execution listeners after set-up.
      if (!listenerAttached) {
        console.log('Attaching listeners');
        NotebookActions.executionScheduled.connect(onScheduled);
        NotebookActions.executed.connect(onExecuted);
        panel.content.activeCellChanged.connect((_, cell) => {
          if (panel.content.activeCell) {
            activeCellId = panel.content.activeCell.model.id;
          }
          console.log('ACTIVE CELL AFTER UPDATE: ', activeCellId);
        });
        listenerAttached = true;
      }
    }

    commands.addCommand(command, {
      label: 'Start Session',
      caption: 'Reacting to FS changes.',
      execute: (args: any) => {
        console.log('begin fs extension');
        if (app && app.shell && app.shell.currentWidget) {
          const curPanel = app.shell.currentWidget as NotebookPanel;
          if (curPanel) {
            panel = curPanel;
            setup(panel);
            attachListeners();
          }
        }
      }
    });
  }
};

export default plugin;
