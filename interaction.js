export const isChoice = value => value === 'A' || value === 'B';
export function nextCriterion(values, ids, current) {
 for (let offset=1;offset<=ids.length;offset++) {
  const next=(current+offset)%ids.length;
  if (!isChoice(values[ids[next]])) return next;
 }
 return current;
}
export function shortcutAction(event) {
 if (event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
 const target=event.target;
 if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')) return null;
 return {ArrowLeft:'A',ArrowRight:'B',' ':'next',Backspace:'previous'}[event.key]||null;
}
