# Haven LiveMap - Project TODO

## Phase 1: Foundation
- [x] Database schema (users, teams, members, projects, processes, canvas_objects, edges, groups, save_points, share_links)
- [x] Design system (teal/green accent, professional theme, CSS variables)
- [x] Install React Flow and dependencies

## Phase 2: API Layer
- [x] Project CRUD router (list, create, edit, delete, lastOpened)
- [x] Process CRUD router (list, get, create, edit, delete)
- [x] CanvasObject router (list, create, edit, delete, bulk operations)
- [x] Edge router (list, create, edit, delete)
- [x] Group/Swimlane router (list, create, edit, delete, reorder)
- [x] SavePoint router (list, create, revert)
- [x] Share router (create link, get shared process, toggle)
- [ ] Team/Member router (list, invite, remove, update role)

## Phase 3: Auth & Layout
- [x] Dashboard layout with sidebar navigation
- [x] Landing/home page for unauthenticated users

## Phase 4: Project & Process Management
- [x] Dashboard page with project cards and CRUD
- [x] Project detail page with process list
- [x] Create/edit project dialog
- [x] Create/edit process dialog

## Phase 5: Process Editor (Core)
- [x] React Flow canvas with pan, zoom, fit view
- [x] Custom Action node (System/Action/Role three-line format)
- [x] Custom Question/Decision node
- [x] Custom Start and End nodes
- [x] Ghost Action and Ghost Question placeholder nodes
- [x] Node form validation (required fields)
- [x] Edge connections with labels (Yes/No for decisions)
- [x] Editor toolbar (add nodes, zoom, fit, export, share)
- [x] Node context menu (edit, delete, duplicate, add note)
- [x] Keyboard shortcuts (copy, paste, delete, undo, redo)
- [x] Node editing side panel/dialog

## Phase 6: Swimlanes & Advanced Features
- [x] Swimlane/Group system (create, edit, delete, hide/show)
- [x] Auto-formatting algorithm (arrange by role or system)
- [x] Capture mode (guided step-by-step mapping with ghost nodes)
- [ ] Domain view toggle (filter by role/department)

## Phase 7: Export, History & Sharing
- [x] Export to PNG
- [x] Export to SVG
- [x] Export to PDF (jsPDF + html2canvas)
- [x] Save point system (create named checkpoints)
- [x] Undo/redo functionality
- [x] Share process (public link, read-only view)
- [x] Shared process viewer page

## Phase 8: Polish & Delivery
- [x] Write vitest tests for API routers (42 tests passing)
- [x] Write vitest tests for editor utility functions
- [x] Verify all features working
- [x] Create checkpoint
- [x] Push to GitHub repository

## Phase 9: UX Overhaul
- [x] Rename app from "Haven LiveMap" to "LiveMap" everywhere
- [x] Drag-and-drop node palette (floating panel with A and Q icons to drag onto canvas)
- [x] Inline node editing (edit fields directly inside the node, no popup/side panel)
- [x] Remove auto-created Start node on new process creation
- [x] Seamless mapping flow (frictionless, fast process mapping experience)
- [x] Update tests and checkpoint
- [x] Push updated code to GitHub


## Phase 10: Smart Auto-Connection
- [x] Auto-snap and connect nodes when dragging from palette near existing nodes
- [x] Auto-connect when moving existing nodes close to each other
- [x] Visual snap zone feedback (highlight drop zones)
- [x] Connection preview (show edge preview before drop)
- [x] Smart edge routing (avoid overlaps, clean paths)
- [x] Test auto-connection workflow
- [x] Checkpoint saved
- [ ] Push updated code to GitHub

## Phase 11: Pull-to-Create & Smart Autocomplete
- [x] Pull-to-create: dragging connection handle from a node creates a new node at drop point and auto-connects
- [x] Show node type picker (Action/Question) when pulling to create
- [x] Field value history: collect all previously used System, Action, Role values across processes
- [x] Autocomplete UI for System field with searchable dropdown
- [x] Autocomplete UI for Action field with searchable dropdown
- [x] Autocomplete UI for Role field with searchable dropdown
- [x] Test pull-to-create workflow
- [x] Test autocomplete workflow
- [ ] Checkpoint and push to GitHub

## Phase 12: Node Redesign + Pull-to-Create + Autocomplete
- [x] Redesign Action node: clean square, thick black border, no colored header, centered Action/System/Role text
- [x] Redesign Question node: cloud/scalloped shape, centered Question text, "Answer" labeled edges
- [x] Update NodePalette to match new node styles
- [x] Pull-to-create: dragging connection handle from node spawns new node at drop point
- [x] Node type picker popup when pulling to create (Action or Question)
- [x] Field autocomplete: collect previously used System/Action/Role values
- [x] Searchable dropdown for System field
- [x] Searchable dropdown for Action field
- [x] Searchable dropdown for Role field
- [x] Test all features end-to-end
- [ ] Checkpoint and push to GitHub

## Phase 13: Node Type Conversion & Prettier Shapes
- [x] Add Action ↔ Question type toggle on nodes (convert between types)
- [x] Redesign Action node with prettier styling (better shadows, proportions, rounded corners)
- [x] Redesign Question node with prettier cloud/scalloped shape (smoother curves, better visual)
- [x] Ensure drag always creates a generic node that can be toggled
- [x] Test node type conversion workflow
- [ ] Checkpoint and push to GitHub

## Phase 14: Right-Click Context Menu
- [x] Create NodeContextMenu component with Delete, Duplicate, Add Note options
- [x] Integrate context menu into ProcessEditor (onNodeContextMenu handler)
- [x] Implement Delete action (remove node and connected edges)
- [x] Implement Duplicate action (clone node with offset position)
- [x] Implement Add Note action (create a note node attached to the selected node)
- [x] Test context menu workflow
- [x] Checkpoint and push to GitHub

## Phase 15: UX Polish - Autocomplete, Edges, Notes
- [x] Fix autocomplete: saved values must appear as clickable selectable suggestions to autofill fields
- [x] Draggable connections: edges should be reconnectable by dragging endpoints to different nodes
- [x] Remove Start node type entirely from palette, toolbar, and node types
- [x] Auto-label Question edges: outputs automatically labeled "Yes" and "No"
- [x] Invisible editable edge labels: all edges have hidden text field, visible/editable on click
- [x] Post-it note icon on nodes: small icon next to convert button that opens inline sticky note
- [x] Test all features end-to-end
- [ ] Checkpoint and push to GitHub

## Phase 16: Keyboard Shortcuts
- [x] Delete key removes selected nodes and their connected edges
- [x] Backspace key also removes selected nodes
- [x] Ctrl+D duplicates selected node(s) with offset
- [x] Ctrl+Z undo (revert last action)
- [x] Ctrl+Shift+Z / Ctrl+Y redo (re-apply undone action)
- [x] Ctrl+A select all nodes
- [x] Escape deselect all nodes
- [x] Prevent shortcuts from firing when editing text inputs
- [x] Test all keyboard shortcuts
- [x] Checkpoint and push to GitHub

## Phase 17: Fix Autocomplete Selection + Draggable Edge Reconnection
- [x] Fix autocomplete: clicking a saved suggestion must fill the text field and save the value to DB
- [x] Make connection lines draggable/reconnectable (detach endpoint and reconnect to different node)
- [x] Improve auto-format to produce cleaner edge routing
- [x] Test both fixes end-to-end
- [x] Checkpoint and push to GitHub

## Phase 18: Handle Visibility + Fast Pull-to-Create
- [x] Connection handles (teal circles) only visible on node hover, hidden by default
- [x] Remove node type picker popup when pulling to create — always create Action node directly
- [x] Test hover-only handles and fast pull-to-create
- [x] Checkpoint and push to GitHub

## Phase 19: Swimlanes Based on Role
- [x] Render horizontal swimlane backgrounds grouped by Role field
- [x] Label each swimlane with the role name on the left side
- [x] Auto-layout respects swimlanes (nodes grouped by role into lanes)
- [x] Swimlanes dynamically update when node roles change
- [x] Toggle swimlane visibility on/off
- [x] Test swimlanes in browser
- [x] Checkpoint and push to GitHub

## Phase 20: Drag-to-Assign Swimlane
- [x] Detect when a node is dropped inside a different swimlane band
- [x] Auto-update the node's Role field to match the target swimlane
- [x] Persist the role change to the database
- [x] Test drag-to-assign in browser
- [x] Checkpoint and push to GitHub
