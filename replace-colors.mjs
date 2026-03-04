import fs from 'fs';
import path from 'path';

const pagesDir = './src/pages';
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

const replacements = [
    // Backgrounds
    { match: /\bbg-white\b/g, replace: 'bg-card' },
    { match: /\bbg-slate-50(?:\/50)?\b/g, replace: 'bg-background' },
    { match: /\bbg-slate-100\b/g, replace: 'bg-muted' },
    { match: /\bbg-slate-900\b/g, replace: 'bg-foreground' },
    { match: /\bbg-slate-950\b/g, replace: 'bg-popover' },

    // Text
    { match: /\btext-slate-900\b/g, replace: 'text-foreground' },
    { match: /\btext-slate-800\b/g, replace: 'text-foreground' },
    { match: /\btext-slate-700\b/g, replace: 'text-card-foreground' },
    { match: /\btext-slate-600\b/g, replace: 'text-muted-foreground' },
    { match: /\btext-slate-500\b/g, replace: 'text-muted-foreground' },
    { match: /\btext-slate-400\b/g, replace: 'text-muted-foreground' },
    { match: /\btext-black\b/g, replace: 'text-foreground' },

    // Borders
    { match: /\bborder-slate-100\b/g, replace: 'border-border' },
    { match: /\bborder-slate-200\b/g, replace: 'border-border' },
    { match: /\bborder-slate-300\b/g, replace: 'border-border' },
    { match: /\bborder-slate-50\b/g, replace: 'border-border' },

    // Primary (Indigo -> Primary)
    { match: /\btext-indigo-600\b/g, replace: 'text-primary' },
    { match: /\btext-indigo-700\b/g, replace: 'text-primary' },
    { match: /\btext-indigo-500\b/g, replace: 'text-primary' },
    { match: /\btext-violet-600\b/g, replace: 'text-primary' },
    { match: /\btext-indigo-300\b/g, replace: 'text-primary/70' },

    { match: /\bbg-indigo-600\b/g, replace: 'bg-primary' },
    { match: /\bbg-indigo-700\b/g, replace: 'bg-primary/90' },
    { match: /\bbg-indigo-500\b/g, replace: 'bg-primary' },

    { match: /\bbg-indigo-50\b/g, replace: 'bg-primary/10' },
    { match: /\bbg-indigo-50(?:\/50)?\b/g, replace: 'bg-primary/10' },
    { match: /\bbg-indigo-100\b/g, replace: 'bg-primary/20' },

    { match: /\bborder-indigo-100\b/g, replace: 'border-primary/20' },
    { match: /\bborder-indigo-200\b/g, replace: 'border-primary/30' },

    // Rings
    { match: /\bring-indigo-500\b/g, replace: 'ring-ring' },
    { match: /\bring-slate-100\b/g, replace: 'ring-border' },

    // Shadows
    { match: /\bshadow-indigo-100\b/g, replace: 'shadow-primary/20' },
    { match: /\bshadow-slate-200\b/g, replace: 'shadow-sm' },

    // Gradients
    { match: /\bfrom-indigo-600\b/g, replace: 'from-primary' },
    { match: /\bto-violet-600\b/g, replace: 'to-primary/80' },

    // Fills
    { match: /\bfill-indigo-600\b/g, replace: 'fill-primary' }
];

files.forEach(file => {
    const filePath = path.join(pagesDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    replacements.forEach(({ match, replace }) => {
        content = content.replace(match, replace);
    });

    // Fix text-white to text-primary-foreground if button is already bg-primary
    content = content.replace(/bg-primary([^"']*)text-white/g, 'bg-primary$1text-primary-foreground');

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    }
});

console.log('Class replacement completed');
