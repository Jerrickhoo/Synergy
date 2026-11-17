import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon.jsx";

function optionText(children) {
  return Children.toArray(children)
    .map((child) =>
      isValidElement(child) ? optionText(child.props.children) : String(child),
    )
    .join("");
}
function childOptions(children) {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) return childOptions(child.props.children);
    if (child.type !== "option") return [];
    const label = optionText(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: child.props.disabled,
      },
    ];
  });
}

// Keep a native select for FormData, reset and constraint validation. The
// visible control is a select-only combobox; DOM focus stays on its trigger.
export default function SelectField({
  id,
  label,
  options: suppliedOptions,
  children,
  value,
  defaultValue,
  name,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Choose an option",
  helperText,
  error,
  className = "",
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}) {
  const options = suppliedOptions ?? childOptions(children);
  const initialValue =
    defaultValue ??
    (children ? options.find((option) => !option.disabled)?.value : "") ??
    "";
  const generatedId = useId();
  const controlId = id || generatedId;
  const listId = `${controlId}-options`;
  const trigger = useRef(null);
  const native = useRef(null);
  const panel = useRef(null);
  const search = useRef({ text: "", at: 0 });
  const [localValue, setLocalValue] = useState(initialValue);
  const [externalLabel, setExternalLabel] = useState("");
  const accessibleLabel = ariaLabel || label || externalLabel;
  const controlledValue = useRef(value);
  controlledValue.current = value;
  const selectedValue = String(value ?? localValue);
  const selected = options.findIndex(
    (option) => String(option.value) === selectedValue,
  );
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [invalid, setInvalid] = useState(false);
  const [placement, setPlacement] = useState(null);
  const enabled = options
    .map((option, index) => (!option.disabled ? index : -1))
    .filter((index) => index !== -1);
  const expanded = open && !disabled;
  const active = enabled.includes(highlighted) ? highlighted : -1;
  const description =
    [
      describedBy,
      helperText && `${controlId}-help`,
      (error || invalid) && `${controlId}-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  useLayoutEffect(() => {
    setExternalLabel(trigger.current.labels?.[0]?.textContent.trim() || "");
  }, [controlId]);
  const optionValues = options
    .map((option) => `${option.value}:${Boolean(option.disabled)}`)
    .join("\n");
  useLayoutEffect(() => {
    if (value === undefined) setLocalValue(native.current.value);
  }, [optionValues, value]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    const close = (event) => {
      if (event.detail !== controlId) setOpen(false);
    };
    window.addEventListener("synergy:popover", close);
    return () => window.removeEventListener("synergy:popover", close);
  }, [controlId]);

  useEffect(() => {
    const form = native.current?.form;
    let resetTimer;
    const reset = () => {
      setOpen(false);
      setInvalid(false);
      // A microtask may run before the reset event's default action. Read in
      // the next task, after the browser has restored the native selection.
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (controlledValue.current !== undefined && native.current)
          native.current.value = String(controlledValue.current);
        else setLocalValue(native.current?.value ?? "");
      }, 0);
    };
    form?.addEventListener("reset", reset);
    return () => {
      clearTimeout(resetTimer);
      form?.removeEventListener("reset", reset);
    };
  }, []);

  useLayoutEffect(() => {
    if (!expanded) return;
    const menu = panel.current;
    menu.showPopover();
    const position = () => {
      const bounds = trigger.current.getBoundingClientRect();
      // DOM rectangles use viewport pixels, while fixed-position CSS values
      // still inherit ancestor CSS zoom. Convert back to the panel's units.
      let scale = 1;
      for (let element = menu; element; element = element.parentElement)
        scale *= Number.parseFloat(getComputedStyle(element).zoom) || 1;
      const viewport = window.visualViewport;
      let left = viewport?.offsetLeft || 0;
      let top = viewport?.offsetTop || 0;
      let width = viewport?.width || window.innerWidth;
      let height = viewport?.height || window.innerHeight;
      // Inside a modal, keep the list within the dialog instead of letting it
      // spill past the modal's edges.
      const dialog = menu.closest("dialog");
      if (dialog) {
        const frame = dialog.getBoundingClientRect();
        const right = Math.min(left + width, frame.right);
        const bottom = Math.min(top + height, frame.bottom);
        left = Math.max(left, frame.left);
        top = Math.max(top, frame.top);
        width = Math.max(0, right - left);
        height = Math.max(0, bottom - top);
      }
      const gap = 6;
      const below = top + height - bounds.bottom - gap - 8;
      const above = bounds.top - top - gap - 8;
      const goesUp =
        below < Math.min(menu.scrollHeight * scale, 280) && above > below;
      const maxHeight = Math.max(0, Math.min(280, goesUp ? above : below));
      const menuWidth = Math.min(bounds.width, width - 16);
      setPlacement({
        width: menuWidth / scale,
        maxHeight: maxHeight / scale,
        left:
          Math.max(
            left + 8,
            Math.min(bounds.left, left + width - menuWidth - 8),
          ) / scale,
        top:
          (goesUp
            ? Math.max(
                top + 8,
                bounds.top -
                  gap -
                  Math.min(menu.scrollHeight * scale, maxHeight),
              )
            : bounds.bottom + gap) / scale,
      });
    };
    const dismiss = (event) => {
      if (
        !menu.contains(event.target) &&
        !trigger.current.contains(event.target)
      )
        setOpen(false);
    };
    const resize = new ResizeObserver(position);
    resize.observe(trigger.current);
    resize.observe(menu);
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      menu.hidePopover();
      resize.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      document.removeEventListener("pointerdown", dismiss, true);
    };
  }, [expanded]);

  useEffect(() => {
    if (expanded && active >= 0)
      panel.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [expanded, active]);

  function show(edge) {
    window.dispatchEvent(
      new CustomEvent("synergy:popover", { detail: controlId }),
    );
    search.current = { text: "", at: 0 };
    setHighlighted(
      enabled.includes(selected)
        ? selected
        : edge === "last"
          ? (enabled.at(-1) ?? -1)
          : (enabled[0] ?? -1),
    );
    setOpen(true);
  }
  function commit(index) {
    if (!enabled.includes(index)) return;
    const next = String(options[index].value);
    if (native.current.value !== next) {
      native.current.value = next;
      native.current.dispatchEvent(new Event("input", { bubbles: true }));
      native.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setOpen(false);
    trigger.current.focus();
  }
  function keyDown(event) {
    const { key } = event;
    if (key === "Tab") {
      setOpen(false);
      return;
    }
    if (key === "Escape" && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      // Space is also part of a multi-word type-ahead search.
      if (!(
        key === " " &&
        expanded &&
        search.current.text &&
        Date.now() - search.current.at < 700
      )) {
        event.preventDefault();
        if (!expanded) {
          show(key === "ArrowUp" ? "last" : "first");
          if (key === "Home") setHighlighted(enabled[0] ?? -1);
          if (key === "End") setHighlighted(enabled.at(-1) ?? -1);
        } else if (key === "Enter" || key === " ") commit(active);
        else if (key === "Home") setHighlighted(enabled[0] ?? -1);
        else if (key === "End") setHighlighted(enabled.at(-1) ?? -1);
        else {
          const index = enabled.indexOf(active);
          setHighlighted(
            enabled[
              Math.max(
                0,
                Math.min(
                  enabled.length - 1,
                  index + (key === "ArrowDown" ? 1 : -1),
                ),
              )
            ] ?? -1,
          );
        }
        return;
      }
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const previous = now - search.current.at < 700 ? search.current.text : "";
      const text = previous + key.toLocaleLowerCase();
      const query = [...text].every((letter) => letter === text[0])
        ? text[0]
        : text;
      search.current = { text, at: now };
      const start = enabled.indexOf(expanded ? active : selected);
      const ordered = [
        ...enabled.slice(start + 1),
        ...enabled.slice(0, start + 1),
      ];
      const found = ordered.find((index) =>
        options[index].label.toLocaleLowerCase().startsWith(query),
      );
      if (!expanded) {
        window.dispatchEvent(
          new CustomEvent("synergy:popover", { detail: controlId }),
        );
        setOpen(true);
      }
      if (found !== undefined) setHighlighted(found);
    }
  }

  return (
    <div className={`select-field ${className}`}>
      {label && (
        <label id={`${controlId}-label`} htmlFor={controlId}>
          {label}
        </label>
      )}
      <select
        ref={native}
        className="select-field-native"
        hidden
        id={`${controlId}-native`}
        data-select-trigger={controlId}
        data-validation-label={accessibleLabel}
        name={name}
        aria-hidden="true"
        tabIndex={-1}
        disabled={disabled}
        required={required}
        value={value === undefined ? undefined : selectedValue}
        defaultValue={value === undefined ? initialValue : undefined}
        onChange={(event) => {
          setLocalValue(event.target.value);
          setInvalid(false);
          onChange?.(event);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current.focus();
        }}
      >
        {!children &&
          !options.some((option) => String(option.value) === "") && (
            <option value="">{placeholder}</option>
          )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <button
        ref={trigger}
        id={controlId}
        type="button"
        value={selectedValue}
        role="combobox"
        className="select-field-trigger interactive-surface"
        disabled={disabled}
        aria-label={accessibleLabel || undefined}
        aria-labelledby={!ariaLabel && label ? `${controlId}-label` : undefined}
        aria-describedby={description}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        aria-activedescendant={
          expanded && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-required={required || undefined}
        aria-invalid={
          Boolean(
            error || invalid || ariaInvalid === true || ariaInvalid === "true",
          ) || undefined
        }
        onClick={() => {
          // Safari does not focus buttons on pointer activation. Keyboard
          // navigation must start on this trigger in every engine.
          trigger.current.focus();
          if (expanded) setOpen(false);
          else show();
        }}
        onKeyDown={keyDown}
        onBlur={() => setOpen(false)}
      >
        <span>{options[selected]?.label ?? placeholder}</span>
        <Icon name="chevron" />
      </button>
      {helperText && (
        <p className="field-help" id={`${controlId}-help`}>
          {helperText}
        </p>
      )}
      {(error || invalid) && (
        <p className="select-field-error" id={`${controlId}-error`}>
          {error || "Choose an option."}
        </p>
      )}
      {expanded &&
        createPortal(
          <div
            ref={panel}
            popover="manual"
            id={listId}
            role="listbox"
            aria-label={accessibleLabel}
            className="select-field-options"
            style={placement || { visibility: "hidden" }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.length ? (
              options.map((option, index) => (
                <div
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected === index}
                  aria-disabled={option.disabled || undefined}
                  data-index={index}
                  data-value={String(option.value)}
                  data-highlighted={active === index || undefined}
                  className="select-field-option"
                  onPointerMove={() =>
                    !option.disabled && setHighlighted(index)
                  }
                  onClick={() => commit(index)}
                >
                  <span>{option.label}</span>
                  {selected === index && <Icon name="check" />}
                </div>
              ))
            ) : (
              <p className="select-field-empty">No options available</p>
            )}
          </div>,
          trigger.current?.closest("dialog") || document.body,
        )}
    </div>
  );
}
