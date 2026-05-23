export const postContent = `
/* ViniApp Tailwind DaisyUI compatibility layer.
   Keep this in sync with the backend generated-app cleanup fallback. */
@theme {
  --shadow-center: 0 0 12px -2px rgb(0 0 0 / 0.05);
  --animate-pulse-fast: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  --color-primary: #10b981;
  --color-primary-content: #ffffff;
  --color-secondary: #8b5cf6;
  --color-secondary-content: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-content: #0f172a;
  --color-neutral: #1e293b;
  --color-neutral-content: #f8fafc;
  --color-base-100: #ffffff;
  --color-base-200: #f8fafc;
  --color-base-300: #e2e8f0;
  --color-base-content: #0f172a;
  --color-info: #06b6d4;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --radius-field: 0.75rem;
  --radius-box: 1.25rem;
  --tt-tailw: 6px;
}

:root,
[data-theme="light"] {
  color-scheme: light;
  --color-primary: #10b981;
  --color-primary-content: #ffffff;
  --color-secondary: #8b5cf6;
  --color-secondary-content: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-content: #0f172a;
  --color-neutral: #1e293b;
  --color-neutral-content: #f8fafc;
  --color-base-100: #ffffff;
  --color-base-200: #f8fafc;
  --color-base-300: #e2e8f0;
  --color-base-content: #0f172a;
  --color-info: #06b6d4;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --tt-bg: var(--color-primary);
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-primary: #34d399;
  --color-primary-content: #022c22;
  --color-secondary: #a78bfa;
  --color-secondary-content: #1e1b4b;
  --color-accent: #fbbf24;
  --color-accent-content: #451a03;
  --color-neutral: #0f172a;
  --color-neutral-content: #e2e8f0;
  --color-base-100: #0c0f17;
  --color-base-200: #111827;
  --color-base-300: #1e293b;
  --color-base-content: #f1f5f9;
  --color-info: #22d3ee;
  --color-success: #4ade80;
  --color-warning: #fbbf24;
  --color-error: #f87171;
  --tt-bg: var(--color-primary);
}

@layer components {
  .btn {
    @apply inline-flex min-h-10 items-center justify-center gap-2 rounded-field border border-transparent px-4 py-2 text-sm font-medium tracking-tight shadow-none transition-all duration-200;
    @apply bg-base-200 text-base-content hover:bg-base-300 hover:scale-[1.02] active:scale-[0.98];
  }

  .btn:disabled,
  .btn[disabled],
  .btn-disabled {
    @apply pointer-events-none opacity-50 grayscale;
  }

  .btn-primary {
    @apply border-none bg-gradient-to-r from-primary to-emerald-500 text-primary-content hover:from-primary hover:to-emerald-400;
  }

  [data-theme="dark"] .btn-primary {
    @apply from-primary to-teal-400;
  }

  .btn-secondary {
    @apply border-none bg-secondary text-secondary-content hover:bg-secondary/90;
  }

  .btn-accent {
    @apply border-none bg-accent text-accent-content hover:bg-accent/90;
  }

  .btn-neutral {
    @apply border-none bg-neutral text-neutral-content hover:bg-neutral/90;
  }

  .btn-success {
    @apply border-none bg-success text-white hover:bg-success/90;
  }

  .btn-warning {
    @apply border-none bg-warning text-accent-content hover:bg-warning/90;
  }

  .btn-error {
    @apply border-none bg-error text-white hover:bg-error/90;
  }

  .btn-ghost {
    @apply border-transparent bg-transparent shadow-none hover:bg-base-content/10;
  }

  .btn-outline {
    @apply border-base-300 bg-transparent hover:border-primary hover:bg-primary/10;
  }

  .btn-outline.btn-error {
    @apply border-error bg-transparent text-error hover:bg-error hover:text-white;
  }

  .btn-xs {
    @apply min-h-6 rounded-lg px-2 py-0.5;
    font-size: 0.6875rem;
  }

  .btn-sm {
    @apply min-h-8 rounded-xl px-3 py-1 text-xs;
  }

  .btn-lg {
    @apply min-h-12 rounded-2xl px-5 py-3 text-lg;
  }

  .btn-block {
    @apply w-full;
  }

  .btn-circle,
  .btn-square {
    @apply aspect-square p-0;
  }

  .btn-circle {
    @apply rounded-full;
  }

  .navbar {
    @apply flex min-h-16 w-full items-center gap-2 px-4;
  }

  .navbar-start,
  .navbar-center,
  .navbar-end {
    @apply flex items-center;
  }

  .navbar-start {
    @apply justify-start;
  }

  .navbar-center {
    @apply flex-1 justify-center;
  }

  .navbar-end {
    @apply justify-end;
  }

  .card {
    @apply rounded-box bg-base-100 text-base-content;
  }

  .card-body {
    @apply flex flex-col gap-3 p-6;
  }

  .card-title {
    @apply flex items-center gap-2 text-xl font-semibold;
  }

  .card-actions {
    @apply flex items-center gap-2;
  }

  .badge {
    @apply inline-flex items-center justify-center rounded-full border border-base-300 bg-base-200 px-2.5 py-0.5 text-xs font-medium leading-none text-base-content;
  }

  .badge-primary {
    @apply border-primary/20 bg-primary/15 text-primary;
  }

  .badge-secondary {
    @apply border-secondary/20 bg-secondary/15 text-secondary;
  }

  .badge-accent {
    @apply border-accent/20 bg-accent/15 text-accent;
  }

  .badge-success {
    @apply border-success/20 bg-success/15 text-success;
  }

  .badge-warning {
    @apply border-warning/20 bg-warning/15 text-warning;
  }

  .badge-error {
    @apply border-error/20 bg-error/15 text-error;
  }

  .input,
  .textarea,
  .select {
    @apply w-full rounded-field border border-base-300/50 bg-base-200/50 px-3 py-2 text-sm text-base-content transition-all duration-200;
    @apply placeholder:text-base-content/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20;
  }

  .input,
  .select {
    @apply h-10;
  }

  .textarea {
    @apply min-h-24 rounded-xl;
  }

  .select {
    @apply appearance-none pr-9;
    background-image:
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      calc(100% - 18px) calc(50% + 1px),
      calc(100% - 13px) calc(50% + 1px);
    background-size:
      5px 5px,
      5px 5px;
    background-repeat: no-repeat;
  }

  .input-bordered,
  .textarea-bordered,
  .select-bordered {
    @apply border-base-300;
  }

  .textarea-primary {
    @apply border-primary/50 focus:border-primary;
  }

  .label {
    @apply flex items-center justify-between gap-2 py-1.5;
  }

  .label-text {
    @apply text-sm font-medium text-base-content/70;
  }

  .form-control {
    @apply flex flex-col gap-1.5;
  }

  .checkbox,
  .radio {
    @apply inline-grid h-5 w-5 shrink-0 cursor-pointer appearance-none place-content-center border border-base-300 bg-base-100 text-primary transition-colors duration-200;
  }

  .checkbox {
    @apply rounded-md;
  }

  .radio {
    @apply rounded-full;
  }

  .checkbox-primary,
  .radio-primary {
    @apply checked:border-primary checked:bg-primary;
  }

  .checkbox:checked::after {
    content: "";
    width: 0.35rem;
    height: 0.6rem;
    transform: rotate(45deg);
    border: solid var(--color-primary-content);
    border-width: 0 2px 2px 0;
    margin-top: -0.1rem;
  }

  .radio:checked::after {
    content: "";
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 9999px;
    background: var(--color-primary-content);
  }

  .toggle {
    @apply h-6 w-11 cursor-pointer appearance-none rounded-full border border-base-300 bg-base-300 p-0.5 transition-colors duration-200;
  }

  .toggle::before {
    content: "";
    display: block;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 9999px;
    background: var(--color-base-100);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    transition: transform 0.2s ease;
  }

  .toggle:checked {
    @apply border-primary bg-primary;
  }

  .toggle:checked::before {
    transform: translateX(1.25rem);
  }

  .swap {
    @apply relative inline-grid place-content-center align-middle;
  }

  .swap > * {
    @apply col-start-1 row-start-1 transition duration-200;
  }

  .swap-on,
  .swap-active .swap-off {
    @apply scale-0 opacity-0;
  }

  .swap-off,
  .swap-active .swap-on {
    @apply scale-100 opacity-100;
  }

  .swap-rotate .swap-on,
  .swap-rotate.swap-active .swap-off {
    @apply rotate-45;
  }

  .swap-rotate .swap-off,
  .swap-rotate.swap-active .swap-on {
    @apply rotate-0;
  }

  .alert {
    @apply flex items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4 text-sm text-base-content;
  }

  .alert-info {
    @apply border-info/25 bg-info/10 text-info;
  }

  .alert-success {
    @apply border-success/25 bg-success/10 text-success;
  }

  .alert-warning {
    @apply border-warning/25 bg-warning/10 text-warning;
  }

  .alert-error {
    @apply border-error/25 bg-error/10 text-error;
  }

  .loading {
    @apply inline-block shrink-0 align-middle text-current;
  }

  .loading-spinner {
    @apply rounded-full border-2 border-current border-r-transparent animate-spin;
    width: 1.5rem;
    height: 1.5rem;
  }

  .loading-xs {
    width: 1rem;
    height: 1rem;
    font-size: 0.75rem;
  }

  .loading-sm {
    width: 1.25rem;
    height: 1.25rem;
    font-size: 0.875rem;
  }

  .loading-lg {
    width: 2rem;
    height: 2rem;
  }

  .tabs {
    @apply flex flex-wrap items-center gap-1;
  }

  .tabs-lift {
    @apply gap-0 border-b border-base-300;
  }

  .tab {
    @apply inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-base-content/65 transition-colors duration-200 hover:text-base-content;
  }

  .tab-active {
    @apply bg-base-100 text-primary shadow-sm;
  }

  .tabs-lift .tab {
    @apply rounded-b-none border border-transparent;
  }

  .tabs-lift .tab-active {
    @apply border-base-300 border-b-base-100;
  }

  .modal-toggle {
    @apply fixed h-0 w-0 appearance-none opacity-0;
  }

  .modal {
    @apply fixed inset-0 z-50 hidden items-center justify-center bg-black/50 p-4;
  }

  .modal-toggle:checked + .modal {
    @apply flex;
  }

  .modal-box {
    @apply max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-box bg-base-100 p-6 text-base-content shadow-2xl;
  }

  .modal-action {
    @apply mt-6 flex justify-end gap-2;
  }

  .dropdown {
    @apply relative inline-block;
  }

  .dropdown-content {
    @apply absolute top-full z-50 mt-2 hidden min-w-max rounded-box border border-base-300 bg-base-100 text-base-content shadow-xl;
  }

  .dropdown-end .dropdown-content {
    @apply right-0;
  }

  .dropdown:focus-within .dropdown-content,
  details.dropdown[open] .dropdown-content {
    @apply flex flex-col;
  }

  .dropdown-toggle {
    list-style: none;
  }

  .dropdown-toggle::-webkit-details-marker {
    display: none;
  }

  .menu {
    @apply flex flex-col;
  }

  .menu-horizontal {
    @apply flex-row;
  }

  .menu :where(li > *),
  .menu-item {
    @apply rounded-xl px-3 py-2 text-sm hover:bg-base-content/10;
  }

  .menu-compact :where(li > *),
  .menu-compact .menu-item {
    @apply px-2 py-1.5 text-sm;
  }

  .table {
    @apply w-full border-collapse text-sm;
  }

  .table :where(th, td) {
    @apply border-b border-base-300/50 px-4 py-3 align-middle;
  }

  .table :where(th) {
    @apply bg-base-200 text-left font-semibold;
  }

  .table-sm :where(th, td) {
    @apply px-3 py-2 text-sm;
  }

  .table-md :where(th, td) {
    @apply px-4 py-3;
  }

  .table-lg :where(th, td) {
    @apply px-5 py-4 text-base;
  }

  .table-zebra tbody tr:nth-child(even) {
    @apply bg-base-200/45;
  }

  .mockup-code {
    @apply rounded-box bg-neutral p-4 font-mono text-sm text-neutral-content;
  }

  .tooltip {
    @apply relative inline-flex;
  }

  .tooltip::before {
    content: attr(data-tip);
    @apply pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-lg bg-neutral px-2 py-1 text-xs text-neutral-content opacity-0 shadow-lg transition-opacity duration-150;
  }

  .tooltip:hover::before,
  .tooltip-open::before {
    @apply block opacity-100;
  }

  .tooltip::before,
  .tooltip-top::before {
    @apply bottom-full left-1/2 mb-2 -translate-x-1/2;
  }

  .tooltip-bottom::before {
    @apply left-1/2 top-full mt-2 -translate-x-1/2;
  }

  .tooltip-primary::before {
    @apply bg-primary text-primary-content;
  }

  .tooltip-accent::before {
    @apply bg-accent text-accent-content;
  }

  .link {
    @apply cursor-pointer underline;
    text-underline-offset: 3px;
  }

  .link:hover {
    opacity: 85%;
  }
}
`;
