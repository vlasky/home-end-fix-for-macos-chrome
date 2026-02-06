let enabled = true;
chrome.storage.local.get("enabled", function (data) {
  enabled = data.enabled !== undefined ? data.enabled : true;
});

chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName !== "local" || !changes.enabled) return;
  enabled = changes.enabled.newValue;
});

document.addEventListener("keydown", function (e) {
  if (!enabled) return;
  if (e.key !== "Home" && e.key !== "End") return;
  if (e.altKey || e.metaKey) return;

  const context = getEditingContext(e);
  if (context.kind === "none") return;

  if (context.kind === "input" && !supportsSelectionNavigation(context.element)) {
    // Keep browser default behavior for input types with no caret selection API.
    return;
  }
  e.preventDefault();

  if (context.kind === "input" || context.kind === "textarea") {
    handleStandardInput(e, context.element);
  } else {
    handleContentEditable(e, context.root);
  }
}, true);

function getEditingContext(e) {
  const target = getEventTarget(e);
  const targetEl = getElementFromNode(target);
  const deepActive = getDeepActiveElement(document);

  const editableRoot = findEditableRoot(target) || findEditableRoot(deepActive);
  if (editableRoot) {
    return { kind: "contenteditable", root: editableRoot };
  }

  const control = findNearestTextControl(targetEl) || findNearestTextControl(deepActive);
  if (!control) return { kind: "none" };
  if (control.tagName === "TEXTAREA") return { kind: "textarea", element: control };
  return { kind: "input", element: control };
}

function getEventTarget(e) {
  if (typeof e.composedPath === "function") {
    const path = e.composedPath();
    if (path && path.length) return path[0];
  }
  return e.target;
}

function getElementFromNode(node) {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
}

function getParentElementOrHost(node) {
  if (!node) return null;
  if (node.parentElement) return node.parentElement;
  if (typeof node.getRootNode === "function") {
    const root = node.getRootNode();
    if (root && root.host) return root.host;
  }
  return null;
}

function getDeepActiveElement(root) {
  let active = root && root.activeElement ? root.activeElement : null;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function findNearestTextControl(node) {
  let current = node;
  while (current) {
    if (current.tagName === "TEXTAREA" || current.tagName === "INPUT") {
      return current;
    }
    current = getParentElementOrHost(current);
  }
  return null;
}

function supportsSelectionNavigation(input) {
  return typeof input.setSelectionRange === "function" && input.selectionStart !== null && input.selectionEnd !== null;
}

// --- Standard input and textarea handling ---

function handleStandardInput(e, el) {
  const isHome = e.key === "Home";
  const withShift = e.shiftKey;
  const withCtrl = e.ctrlKey;
  const value = el.value;
  const selStart = el.selectionStart;
  const selEnd = el.selectionEnd;
  const selDir = el.selectionDirection || "none";

  // Derive anchor (fixed end) and active (moving end) from direction
  const anchor = (selDir === "backward") ? selEnd : selStart;
  const active = (selDir === "backward") ? selStart : selEnd;

  let target;
  if (withCtrl) {
    target = isHome ? 0 : value.length;
  } else {
    // For shift: move the active end to the line boundary
    // For non-shift: collapse to the appropriate end, then find line boundary
    const cursor = withShift ? active : (isHome ? selStart : selEnd);
    if (el.tagName === "TEXTAREA") {
      const bounds = getVisualLineBounds(el, cursor);
      target = isHome ? bounds.start : bounds.end;
    } else {
      // Single-line input: the whole value is one line
      target = isHome ? 0 : value.length;
    }
  }

  if (withShift) {
    const newStart = Math.min(anchor, target);
    const newEnd = Math.max(anchor, target);
    const newDir = target <= anchor ? "backward" : "forward";
    safeSetSelectionRange(el, newStart, newEnd, newDir);
  } else {
    safeSetSelectionRange(el, target, target);
  }
}

function safeSetSelectionRange(el, start, end, dir) {
  try {
    if (dir) {
      el.setSelectionRange(start, end, dir);
    } else {
      el.setSelectionRange(start, end);
    }
  } catch (_) {
    // Safety guard: avoid throwing if a browser rejects selection updates.
  }
}

// --- ContentEditable handling ---

function handleContentEditable(e, editableRoot) {
  const isHome = e.key === "Home";
  const withShift = e.shiftKey;
  const withCtrl = e.ctrlKey;

  const sel = window.getSelection();
  if (!sel.rangeCount) return;

  if (withCtrl) {
    const editable = editableRoot || findEditableRoot(sel.anchorNode);
    if (!editable) return;

    const range = document.createRange();
    range.selectNodeContents(editable);

    if (withShift) {
      // Anchor stays, focus moves to start/end of editable
      if (isHome) {
        sel.setBaseAndExtent(
          sel.anchorNode, sel.anchorOffset,
          range.startContainer, range.startOffset
        );
      } else {
        sel.setBaseAndExtent(
          sel.anchorNode, sel.anchorOffset,
          range.endContainer, range.endOffset
        );
      }
    } else {
      if (isHome) {
        range.collapse(true);
      } else {
        range.collapse(false);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    // Move/select to start/end of visual line using Selection.modify
    const direction = isHome ? "left" : "right";
    if (withShift) {
      sel.modify("extend", direction, "lineboundary");
    } else {
      sel.modify("move", direction, "lineboundary");
    }
  }
}

function findEditableRoot(node) {
  let current = getElementFromNode(node);
  while (current) {
    if (current.isContentEditable) {
      const parent = getParentElementOrHost(current);
      if (!parent || !parent.isContentEditable) {
        return current;
      }
    }
    current = getParentElementOrHost(current);
  }
  return null;
}

// --- Textarea visual line measurement ---

function getHardLineStart(value, pos) {
  const idx = value.lastIndexOf("\n", pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function getHardLineEnd(value, pos) {
  const idx = value.indexOf("\n", pos);
  return idx === -1 ? value.length : idx;
}

function createMirror(textarea) {
  const mirror = document.createElement("div");
  const cs = window.getComputedStyle(textarea);
  const width = textarea.clientWidth || parseFloat(cs.width) || textarea.offsetWidth || 0;
  mirror.style.position = "fixed";
  mirror.style.visibility = "hidden";
  mirror.style.left = "-9999px";
  mirror.style.top = "0";
  mirror.style.height = "auto";
  mirror.style.width = width + "px";
  mirror.style.boxSizing = "border-box";
  mirror.style.padding = cs.padding;
  mirror.style.border = "0";
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace = cs.whiteSpace;
  mirror.style.overflowWrap = cs.overflowWrap;
  mirror.style.wordWrap = cs.wordWrap;
  mirror.style.wordBreak = cs.wordBreak;
  mirror.style.fontFamily = cs.fontFamily;
  mirror.style.fontSize = cs.fontSize;
  mirror.style.fontWeight = cs.fontWeight;
  mirror.style.fontStyle = cs.fontStyle;
  mirror.style.fontVariant = cs.fontVariant;
  mirror.style.lineHeight = cs.lineHeight;
  mirror.style.letterSpacing = cs.letterSpacing;
  mirror.style.wordSpacing = cs.wordSpacing;
  mirror.style.textTransform = cs.textTransform;
  mirror.style.textIndent = cs.textIndent;
  mirror.style.tabSize = cs.tabSize;
  mirror.style.direction = cs.direction;
  mirror.style.writingMode = cs.writingMode;
  document.body.appendChild(mirror);
  return mirror;
}

function getVisualLineBounds(textarea, cursorPos) {
  const text = textarea.value;
  if (text.length === 0) return { start: 0, end: 0 };

  // Isolate the paragraph (between hard newlines) containing the cursor
  const paraStart = getHardLineStart(text, cursorPos);
  const paraEnd = getHardLineEnd(text, cursorPos);
  const paraText = text.substring(paraStart, paraEnd);

  if (paraText.length === 0) return { start: paraStart, end: paraEnd };

  const mirror = createMirror(textarea);
  try {
    mirror.textContent = paraText;
    const textNode = mirror.firstChild;

    const localCursor = cursorPos - paraStart;

    function charTop(localPos) {
      if (localPos < 0) localPos = 0;
      if (localPos >= paraText.length) localPos = paraText.length - 1;
      const range = document.createRange();
      range.setStart(textNode, localPos);
      range.setEnd(textNode, localPos + 1);
      return range.getBoundingClientRect().top;
    }

    // Use the character at cursor, or the last character if cursor is at paragraph end
    const measurePos = localCursor < paraText.length ? localCursor : paraText.length - 1;
    const cursorTop = charTop(measurePos);

    // Binary search: first character on this visual line
    let lo = 0, hi = measurePos;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (charTop(mid) < cursorTop) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const lineStart = lo + paraStart;

    // Binary search: last character on this visual line
    lo = measurePos;
    hi = paraText.length - 1;
    while (lo < hi) {
      const mid2 = Math.ceil((lo + hi) / 2);
      if (charTop(mid2) > cursorTop) {
        hi = mid2 - 1;
      } else {
        lo = mid2;
      }
    }
    const lineEnd = Math.min(lo + 1 + paraStart, paraEnd);

    return { start: lineStart, end: lineEnd };
  } finally {
    mirror.remove();
  }
}
