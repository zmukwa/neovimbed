'use babel';

import Neovimbed from '../lib/neovimbed';
import { $$textEditorBufferNumber } from '../lib/consts';
import { keyCodeToKeyWithShift } from '../lib/input';
import { loadFile, loadFileGetBufferContents, getBufferContents, waitsForTimeout, timeout, getActivationPromise } from './spec-helper';
import fs from 'fs';

// process.env.NEOVIMBED_USE_SOCKET = true;

function sendKeys(str) {
    // Bypass event system and just pass straight through to input. Working out
    // keycode is a pain.
    window.nvim.input(str);
}

/**
 * If last line is empty assume it was an added new line and return new array with
 * that one removed
 */
function trimTrailingNewline(lines) {
    if (lines.length && lines[lines.length - 1] === '') {
        return lines.slice(0, lines.length - 1);
    }
    return lines;
}

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
//
// To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
// or `fdescribe`). Remove the `f` to unfocus the block.
//
describe('Neovimbed', () => {
    let workspaceElement, activationPromise;

    beforeEach(() => {
        workspaceElement = atom.views.getView(atom.workspace);
        activationPromise = getActivationPromise();
   });

    describe('neovim buffer creation', () => {
        it('read file in neovim, reflected in TextEditor', () => {
            waitsForPromise(() => activationPromise);

            let bufferContents;
            waitsForPromise(async () => bufferContents = await loadFileGetBufferContents(__dirname + '/fixtures/file.txt'));
            waitsForTimeout();

            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = textEditors[0].getBuffer().lines;
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
            });
        });

        it('read multiple files in neovim, reflected in multiple TextEditor', () => {
            waitsForPromise(() => activationPromise);

            let buffer1Contents, buffer2Contents;
            waitsForPromise(async () => buffer1Contents = await loadFileGetBufferContents(__dirname + '/fixtures/file.txt'));
            waitsForPromise(async () => buffer2Contents = await loadFileGetBufferContents(__dirname + '/fixtures/file2.txt'));
            waitsForTimeout();

            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(2);
                const lines1 = textEditors[0].getBuffer().lines;
                expect(lines1.map(line => line.replace(/[ ]+$/, ''))).toEqual(buffer1Contents);
                const lines2 = textEditors[1].getBuffer().lines;
                expect(lines2.map(line => line.replace(/[ ]+$/, ''))).toEqual(buffer2Contents);
            });
        });

        it('open file in Atom, open buffer in nvim', () => {
            waitsForPromise(() => activationPromise);

            let buffer1Contents, buffer2Contents;
            waitsForPromise(() => atom.workspace.open(__dirname + '/fixtures/file.txt'));
            waitsForPromise(() => atom.workspace.open(__dirname + '/fixtures/file2.txt'));
            waitsForTimeout();
            waitsForPromise(async () => buffer1Contents = await getBufferContents(1));
            waitsForPromise(async () => buffer2Contents = await getBufferContents(2));

            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(2);
                const lines1 = textEditors[0].getBuffer().lines;
                expect(lines1.map(line => line.replace(/[ ]+$/, ''))).toEqual(buffer1Contents);
                const lines2 = textEditors[1].getBuffer().lines;
                expect(lines2.map(line => line.replace(/[ ]+$/, ''))).toEqual(buffer2Contents);
            });
        });

    });


    describe('neovim basic buffer changes', () => {
        it('basic motion, insert characters', () => {
            waitsForPromise(() => activationPromise);

            let bufferContents;
            waitsForPromise(() => loadFile(__dirname + '/fixtures/file.txt'));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('gg~Wieveryone ');
                bufferContents = await getBufferContents(1);
            });
            waitsForTimeout();

            runs(async () => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = textEditors[0].getBuffer().lines;
                const text = ["Hello everyone there", "line 2"];
                expect(bufferContents).toEqual(text);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(text);
            });

        });

        it('basic motion, remove characters', () => {
            waitsForPromise(() => activationPromise);

            let bufferContents;
            waitsForPromise(() => loadFile(__dirname + '/fixtures/file.txt'));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('ggcw');
                bufferContents = await getBufferContents(1);
            });

            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = textEditors[0].getBuffer().lines;
                const text = [" there", "line 2"];
                expect(bufferContents).toEqual(text);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(text);
            });

        });

        it('scroll screen', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            const fileContents = fs.readFileSync(path, { encoding: 'utf8' });
            let bufferContents;
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('6j');
                bufferContents = await getBufferContents(1);
            });

            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                const text = fileContents.replace(/\n*$/,'').split("\n");
                const textLines = text;
                expect(bufferContents).toEqual(text);
                expect(lines.length).toEqual(textLines.length);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(textLines);
            });

        });

        it('delete block with bottom section off visible screen', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            let bufferContents;
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('jdi{');
                bufferContents = await getBufferContents(1);
            });
            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = textEditors[0].getBuffer().lines;
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
            });
        });

        it('change tabs, change buffer', () => {
            waitsForPromise(() => activationPromise);

            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/file.txt'));
            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/file2.txt'));
            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/fn.js'));
            waitsForTimeout();

            waitsForPromise(async () => {
                const activePane = atom.workspace.getActivePane();
                const textEditors = atom.workspace.getTextEditors();
                activePane.setActiveItem(textEditors[0]);
                await timeout();
                let activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(textEditors[0][$$textEditorBufferNumber]);
                activePane.setActiveItem(textEditors[1]);
                await timeout();
                activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(textEditors[1][$$textEditorBufferNumber]);
                activePane.setActiveItem(textEditors[0]);
                await timeout();
                activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(textEditors[0][$$textEditorBufferNumber]);
                activePane.setActiveItem(textEditors[2]);
                await timeout();
                activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(textEditors[2][$$textEditorBufferNumber]);
            });
        });

        it('change buffer, change tab', () => {
            waitsForPromise(() => activationPromise);

            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/file.txt'));
            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/file2.txt'));
            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/fn.js'));
            waitsForTimeout();

            waitsForPromise(async () => {
                await window.nvim.command('b1');
                await timeout();
                let activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(1);
                expect(activeBufferNumber).toEqual(atom.workspace.getActiveTextEditor()[$$textEditorBufferNumber]);
                await window.nvim.command('b3');
                await timeout();
                activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(3);
                expect(activeBufferNumber).toEqual(atom.workspace.getActiveTextEditor()[$$textEditorBufferNumber]);
                await window.nvim.command('b2');
                await timeout();
                activeBufferNumber = await window.nvim.getCurrentBuffer().then(buffer => buffer.getNumber());
                expect(activeBufferNumber).toEqual(2);
                expect(activeBufferNumber).toEqual(atom.workspace.getActiveTextEditor()[$$textEditorBufferNumber]);
            });
        });

        it('cursor position in sync', () => {
            waitsForPromise(() => activationPromise);

            waitsForPromise(async () => await loadFile(__dirname + '/fixtures/fn.js'));
            waitsForTimeout();

            waitsForPromise(async () => {
                const win = await window.nvim.getCurrentWindow();
                const editor = atom.workspace.getActiveTextEditor();
                const assertCursorsEqual = async (expectedRow, expectedColumn) => {
                    const [row, column] = await win.getCursor();
                    expect([expectedRow, expectedColumn]).toEqual([row, column + 1]);
                    const cursor = editor.getCursorBufferPosition();
                    expect(row).toEqual(cursor.row + 1);
                }
                await assertCursorsEqual(1, 1);
                sendKeys('10G');
                await assertCursorsEqual(10, 9);
                sendKeys('20|');
                await assertCursorsEqual(10, 20);
            });
        });

        it('jump off screen', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            let bufferContents;
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('G');
                bufferContents = await getBufferContents(1);
            });
            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                console.log(bufferContents.join("\n"));
                console.log(lines.map(line => line.replace(/[ ]+$/, '')).join("\n"));
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
            });
        });

        it('insert new lines', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('2GO<cr>');
                const bufferContents = await getBufferContents(1);
                await timeout();
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                console.log(lines.map(line => line.replace(/[\s]+$/, '')).join('\n'));
                console.log(bufferContents.join("\n"));
                neovimbed.printCells();
                expect(lines.map(line => line.replace(/[\s]+$/, ''))).toEqual(bufferContents);
            });
        });

        it('insert new lines (2)', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('21Go');
                const bufferContents = await getBufferContents(1);
                await timeout();
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                console.log(lines.map(line => line.replace(/[ ]+$/, '')));
                console.log(bufferContents.map(line => line.replace(/[\t ]+$/, '')));
                console.log(lines.map(line => line.replace(/[ ]+$/, '')).join('\n'));
                console.log(bufferContents.join('\n'));
                expect(lines.map(line => line.replace(/[\s]+$/, ''))).toEqual(bufferContents.map(line => line.replace(/[\s]+$/, '')));
            });
        });

        it('delete block with bottom section off visible screen, undo', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys('jdi{u');
                const bufferContents = await getBufferContents(1);
                await timeout();
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
            });
        });

        it('make text changes outside of neovim', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                let bufferContents = await getBufferContents(1);
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                let lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
                textEditors[0].setTextInBufferRange([[1,0], [1,0]], "test");
                lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                const updatedContents = [bufferContents[0], "test", ...bufferContents.slice(2)];
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(updatedContents);
                textEditors[0].getBuffer().emitter.emit('did-stop-changing'); 
                await timeout();
                bufferContents = await getBufferContents(1);
                expect(bufferContents).toEqual(updatedContents);
                console.log(bufferContents.join("\n"));
                console.log(updatedContents.join("\n"));
            });
        });

        it('make text changes outside of neovim (multiple lines)', () => {
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                let bufferContents = await getBufferContents(1);
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                let lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
                textEditors[0].setTextInBufferRange([[12,8],[12,12]], "new Promise(function(resolve, reject) {\n\n});");
                lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                const updatedContents = [...bufferContents.slice(0, 12),  ..."new Promise(function(resolve, reject) {\n\n});".split('\n'), ...bufferContents.slice(13)];
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(updatedContents);
                textEditors[0].getBuffer().emitter.emit('did-stop-changing'); 
                await timeout();
                bufferContents = await getBufferContents(1);
                expect(bufferContents).toEqual(updatedContents);
                console.log(bufferContents.length, updatedContents.length);
                for (let i=0;i<bufferContents.length;i++) {
                    if (bufferContents[i] !== updatedContents[i]) {
                        console.log(i, bufferContents[i], '!=', updatedContents[i]);
                    }
                }
                console.log(lines.join("\n"));
                console.log(bufferContents);
                console.log(updatedContents);
            });
        });

        it('replace text offscreen', () => {
            // Haven't worked out how to handle these yet so currently this is
            // expected to fail
            waitsForPromise(() => activationPromise);

            const path = __dirname + '/fixtures/fn.js';
            let bufferContents;
            waitsForPromise(() => loadFile(path));
            waitsForTimeout();
            waitsForPromise(async () => {
                sendKeys(':%s/i/I/g<cr>');
                bufferContents = await getBufferContents(1);
            });
            runs(() => {
                const textEditors = atom.workspace.getTextEditors();
                expect(textEditors.length).toBe(1);
                const lines = trimTrailingNewline(textEditors[0].getBuffer().lines);
                expect(lines.map(line => line.replace(/[ ]+$/, ''))).toEqual(bufferContents);
            });
        });
    });

});
