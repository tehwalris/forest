var setInProgressAction: any;
var inProgressAction: any;
var setCopiedNode: any;
var copiedNode: any;

export const args = {
  cancelAction: () => setInProgressAction(undefined),
  actionInProgress: !!inProgressAction,
  copyNode: setCopiedNode,
  copiedNode,
};
