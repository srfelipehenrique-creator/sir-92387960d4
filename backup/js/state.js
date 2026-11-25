const appState = {
  currentSnapshot:        { ral: new Map(), rec: new Map() },
  lastSnapshotKeys:       { ral: new Set(), rec: new Set() },
  allNewIdentities:       { ral: new Set(), rec: new Set() },
  previousCounts:         { ral: {}, rec: {} },
  currentCounts:          { ral: {}, rec: {} },
  inboxItems:             [],
  acknowledgedInboxKeys:  new Set(),
  currentModalType:       null,
  currentModalKey:        null,
  inboxBodyVisible:       true,
  ticketStates:           {},
  isOffline:              false,
};

const modalData = { ral: {}, rec: {} };

const modalSortState = { col: 'abertura', dir: 'desc' };
