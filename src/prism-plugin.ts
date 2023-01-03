import { findChildren } from '@tiptap/core';
import {
    Node as ProsemirrorNode,
} from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import Prism from 'prismjs';

import { fromHtml } from 'hast-util-from-html';

import 'prismjs/components/prism-jsx';

function parseNodes(
    nodes: any[],
    className: string[] = []
): { text: string; classes: string[] }[] {
    return nodes
        .map((node) => {
            const classes = [
                ...className,
                ...(node.properties ? node.properties.className : []),
            ];

            if (node.children) {
                return parseNodes(node.children, classes);
            }

            return {
                text: node.value,
                classes,
            };
        })
        .flat();
}

function getHighlightNodes(html: string) {
    return fromHtml(html, { fragment: true }).children;
}

function registeredLang(aliasOrLanguage: string) {
    const allSupportLang = Object.keys(Prism.languages).filter(
        (id) => typeof Prism.languages[id] === 'object'
    );
    return Boolean(allSupportLang.find((x) => x === aliasOrLanguage));
}

function getDecorations({
    doc,
    name,
    defaultLanguage,
}: {
    doc: ProsemirrorNode;
    name: string;
    defaultLanguage: string | null | undefined;
}) {
    const decorations: Decoration[] = [];

    findChildren(doc, (node) => node.type.name === name).forEach((block) => {
        let from = block.pos + 1;
        const language = block.node.attrs.language || defaultLanguage;
        let html: string = '';

        try{
            if(!registeredLang(language)) {
                import("prismjs/components/prism-"+language);
            }
            html = Prism.highlight(block.node.textContent, Prism.languages[language], language);
          }
          catch(err: any){
            console.error(err.message+": \""+language+"\"");
            html = Prism.highlight(block.node.textContent, Prism.languages.javascript, 'js');
          }    

        const nodes = getHighlightNodes(html);

        parseNodes(nodes).forEach((node) => {
            const to = from + node.text.length;

            if (node.classes.length) {
                const decoration = Decoration.inline(from, to, {
                    class: node.classes.join(' '),
                });

                decorations.push(decoration);
            }

            from = to;
        });
    });

    return DecorationSet.create(doc, decorations);
}

export function PrismPlugin({
    name,
    defaultLanguage,
}: {
    name: string;
    defaultLanguage: string | null | undefined;
}) {
    if (
        !defaultLanguage
    ) {
        throw Error(
            'You must specify the defaultLanguage parameter'
        );
    }

    const prismjsPlugin: Plugin<any> = new Plugin({
        key: new PluginKey('prism'),

        state: {
            init: (_, { doc }) =>
                getDecorations({
                    doc,
                    name,
                    defaultLanguage,
                }),
            apply: (transaction, decorationSet, oldState, newState) => {
                const oldNodeName = oldState.selection.$head.parent.type.name;
                const newNodeName = newState.selection.$head.parent.type.name;
                const oldNodes = findChildren(
                    oldState.doc,
                    (node) => node.type.name === name
                );
                const newNodes = findChildren(
                    newState.doc,
                    (node) => node.type.name === name
                );

                if (
                    transaction.docChanged &&
                    // Apply decorations if:
                    // selection includes named node,
                    ([oldNodeName, newNodeName].includes(name) ||
                        // OR transaction adds/removes named node,
                        newNodes.length !== oldNodes.length ||
                        // OR transaction has changes that completely encapsulte a node
                        // (for example, a transaction that affects the entire document).
                        // Such transactions can happen during collab syncing via y-prosemirror, for example.
                        transaction.steps.some((step) => {
                            // @ts-ignore
                            return (
                                // @ts-ignore
                                step.from !== undefined &&
                                // @ts-ignore
                                step.to !== undefined &&
                                oldNodes.some((node) => {
                                    // @ts-ignore
                                    return (
                                        // @ts-ignore
                                        node.pos >= step.from &&
                                        // @ts-ignore
                                        node.pos + node.node.nodeSize <= step.to
                                    );
                                })
                            );
                        }))
                ) {
                    return getDecorations({
                        doc: transaction.doc,
                        name,
                        defaultLanguage,
                    });
                }

                return decorationSet.map(transaction.mapping, transaction.doc);
            },
        },

        props: {
            decorations(state) {
                return prismjsPlugin.getState(state);
            },
        },
    });

    return prismjsPlugin;
}
