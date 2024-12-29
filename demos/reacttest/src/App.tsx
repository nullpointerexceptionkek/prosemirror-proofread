// src/App.tsx
import { useEffect, useRef } from 'react';
import './App.css';
import 'prosemirror-example-setup/style/style.css';
import 'prosemirror-menu/style/menu.css';
import 'prosemirror-proofread/suggestion.css';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { Schema } from 'prosemirror-model';
import { addListNodes } from 'prosemirror-schema-list';
import { exampleSetup } from 'prosemirror-example-setup';

import {
  createProofreadPlugin,
  createSpellCheckEnabledStore,
  createSuggestionBox,
  ProofreadError
} from 'prosemirror-proofread';
import axios from 'axios';

function App() {
  const editorContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorContainer.current) return;

    const mySchema = new Schema({
      nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
      marks: schema.spec.marks
    });

    const spellCheckStore = createSpellCheckEnabledStore(()=>{true});

    const generateProofreadErrors = async (input: string) => {
      const headersList = {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      };
    
      const bodyContent = new URLSearchParams({
        language: 'en-US',
        text: input
      }).toString();
    
      const reqOptions = {
        url: 'https://api.languagetool.org/v2/check',
        method: 'POST',
        headers: headersList,
        data: bodyContent
      };
    
      try {
        const response = await axios.request(reqOptions);
        return response.data;
      } catch (error) {
        console.error('Error:', error);
        throw error;
      }
    };

    const proofreadPlugin = createProofreadPlugin(
      1000,
      generateProofreadErrors,
      createSuggestionBox,
      spellCheckStore,
    );

    const state = EditorState.create({
      schema: mySchema,
      plugins: [...exampleSetup({ schema: mySchema }), proofreadPlugin]
    });
    const view = new EditorView(editorContainer.current, { state });

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div style={{ margin: '1rem' }}>
      <h1>React + TypeScript + ProseMirror-proofread</h1>
      <div
        ref={editorContainer}
        style={{ border: '1px solid #ccc', minHeight: '200px', padding: '0.5rem' }}
      />
    </div>
  );
}

export default App;
