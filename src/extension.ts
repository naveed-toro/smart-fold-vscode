import * as vscode from 'vscode';

// 1. Define the distinct emojis for our modes
const commentDeco = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: { contentText: '💬 ', margin: '0 2px', color: '#888888' }
});

const codeDeco = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none; display: none;',
    before: { contentText: '💻 ', margin: '0 2px', color: '#4CAF50' }
});

// 2. State Managers (PER-FILE / DOCUMENT STATE)
type Mode = 'normal' | 'all' | 'code' | 'comments';
interface DocState {
    mode: Mode;
    unfoldedLines: Set<number>;
    manuallyFoldedLines: Set<number>;
}

// The Dictionary that remembers the state of EACH open file independently
const documentStates = new Map<string, DocState>();
let statusBarItem: vscode.StatusBarItem;

// Helper to get or initialize state for a specific document
function getState(uri: string): DocState {
    if (!documentStates.has(uri)) {
        documentStates.set(uri, {
            mode: 'normal',
            unfoldedLines: new Set(),
            manuallyFoldedLines: new Set()
        });
    }
    return documentStates.get(uri)!;
}

// Helper to clear custom toggles when switching main modes for a specific file
function resetStates(state: DocState) {
    state.unfoldedLines.clear();
    state.manuallyFoldedLines.clear();
}

export function activate(context: vscode.ExtensionContext) {
    
    // --- Setup Status Bar ---
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // Command 1: Clean Slate Mode
    let toggleAll = vscode.commands.registerCommand('smartfold.toggleAll', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const uri = editor.document.uri.toString();
        const state = getState(uri);
        
        state.mode = state.mode === 'all' ? 'normal' : 'all';
        resetStates(state);
        updateDecorations();
        updateStatusBar();
    });

    // Command 2: Reading Mode (Show Comments, Hide Code)
    let toggleCode = vscode.commands.registerCommand('smartfold.toggleCode', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const uri = editor.document.uri.toString();
        const state = getState(uri);

        state.mode = state.mode === 'code' ? 'normal' : 'code';
        resetStates(state);
        updateDecorations();
        updateStatusBar();
    });

    // Command 3: Coding Mode (Show Code, Hide Comments)
    let toggleComments = vscode.commands.registerCommand('smartfold.toggleComments', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const uri = editor.document.uri.toString();
        const state = getState(uri);

        state.mode = state.mode === 'comments' ? 'normal' : 'comments';
        resetStates(state);
        updateDecorations();
        updateStatusBar();
    });

    // Command 4: Universal Intelligent Toggle (Pack/Unpack) - MULTI-LINE SUPPORT
    let toggleCurrent = vscode.commands.registerCommand('smartfold.toggleCurrent', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        
        const document = editor.document;
        const uri = document.uri.toString();
        const state = getState(uri);
        const selectedLines = new Set<number>();

        for (const selection of editor.selections) {
            for (let i = selection.start.line; i <= selection.end.line; i++) {
                if (document.lineAt(i).text.trim() !== '') {
                    selectedLines.add(i);
                }
            }
        }

        if (selectedLines.size === 0) return;

        const firstLine = Math.min(...Array.from(selectedLines));
        const currentlyHidden = isLineHidden(firstLine, document, state);

        for (const lineNum of selectedLines) {
            if (currentlyHidden) {
                state.manuallyFoldedLines.delete(lineNum);
                state.unfoldedLines.add(lineNum);
            } else {
                state.unfoldedLines.delete(lineNum);
                state.manuallyFoldedLines.add(lineNum);
            }
        }
        updateDecorations();
    });

    // Command 5: SMART COPY (Only copy visible lines)
    let smartCopy = vscode.commands.registerCommand('smartfold.smartCopy', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
            return;
        }

        const document = editor.document;
        const uri = document.uri.toString();
        const state = getState(uri);
        let textToCopy: string[] = [];

        for (const selection of editor.selections) {
            if (selection.isEmpty) {
                const lineNum = selection.active.line;
                if (!isLineHidden(lineNum, document, state)) {
                    textToCopy.push(document.lineAt(lineNum).text);
                }
            } else {
                let visibleLinesInSelection: string[] = [];
                for (let i = selection.start.line; i <= selection.end.line; i++) {
                    if (!isLineHidden(i, document, state)) {
                        let startChar = (i === selection.start.line) ? selection.start.character : 0;
                        let endChar = (i === selection.end.line) ? selection.end.character : document.lineAt(i).text.length;
                        visibleLinesInSelection.push(document.lineAt(i).text.substring(startChar, endChar));
                    }
                }
                if (visibleLinesInSelection.length > 0) {
                    textToCopy.push(visibleLinesInSelection.join('\n'));
                }
            }
        }

        if (textToCopy.length > 0) {
            const finalString = textToCopy.join('\n');
            await vscode.env.clipboard.writeText(finalString);
            vscode.window.setStatusBarMessage('$(check) Copied visible lines only!', 3000);
        }
    });

    // Event: Sticky Unfold logic (Mouse Click Only)
    vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.kind !== vscode.TextEditorSelectionChangeKind.Mouse) return;
        
        let needsUpdate = false;
        const document = event.textEditor.document;
        const uri = document.uri.toString();
        const state = getState(uri);

        for (const selection of event.selections) {
            const lineNum = selection.active.line;
            
            if (isLineHidden(lineNum, document, state)) {
                state.manuallyFoldedLines.delete(lineNum);
                state.unfoldedLines.add(lineNum);
                needsUpdate = true;
            }
        }
        if (needsUpdate) updateDecorations();
    }, null, context.subscriptions);

    // Events: Re-apply when typing or switching tabs
    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            updateDecorations();
        }
    }, null, context.subscriptions);
    
    vscode.window.onDidChangeActiveTextEditor(() => {
        updateDecorations();
        updateStatusBar();
    }, null, context.subscriptions);

    // Event: Cleanup memory when a file is closed (Performance optimization)
    vscode.workspace.onDidCloseTextDocument(doc => {
        documentStates.delete(doc.uri.toString());
    }, null, context.subscriptions);

    context.subscriptions.push(toggleAll, toggleCode, toggleComments, toggleCurrent, smartCopy);
}

// --- The Master Brain: Determines visibility dynamically ---
function isLineHidden(lineNum: number, document: vscode.TextDocument, state: DocState, isComment?: boolean): boolean {
    if (state.unfoldedLines.has(lineNum)) return false;     
    if (state.manuallyFoldedLines.has(lineNum)) return true; 

    if (state.mode === 'normal') return false; 
    if (state.mode === 'all') return true;     

    if (isComment === undefined) {
        const text = document.lineAt(lineNum).text.trim();
        if (text === '') return false;
        isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');
    }

    if (state.mode === 'code' && !isComment) return true;    
    if (state.mode === 'comments' && isComment) return true; 
    
    return false;
}

// --- Status Bar Logic ---
function updateStatusBar() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        statusBarItem.hide();
        return;
    }

    const state = getState(editor.document.uri.toString());

    if (state.mode === 'normal') {
        statusBarItem.hide();
    } else {
        if (state.mode === 'all') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Clean Slate 📦`;
        } else if (state.mode === 'code') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Reading Mode 💬`;
        } else if (state.mode === 'comments') {
            statusBarItem.text = `$(eye-closed) Smart Fold: Coding Mode 💻`;
        }
        statusBarItem.show();
    }
}

// --- The Engine: Applies visual emojis ---
function updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const state = getState(document.uri.toString());

    const commentRanges: vscode.Range[] = [];
    const codeRanges: vscode.Range[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text.trim();

        if (text === '') continue;

        const isComment = text.startsWith('//') || text.startsWith('/*') || text.startsWith('*');

        if (isLineHidden(i, document, state, isComment)) {
            const range = new vscode.Range(
                new vscode.Position(i, line.firstNonWhitespaceCharacterIndex),
                new vscode.Position(i, line.text.length)
            );
            
            if (isComment) {
                commentRanges.push(range);
            } else {
                codeRanges.push(range);
            }
        }
    }

    editor.setDecorations(commentDeco, commentRanges);
    editor.setDecorations(codeDeco, codeRanges);
}

export function deactivate() {
    documentStates.clear();
    if (statusBarItem) statusBarItem.dispose();
}