#!/usr/bin/env python3
"""Report likely button dimension violations in the MZ mobile source.

This is intentionally a review aid, not an AST replacement tool. It reports
semantic-looking style names with hard-coded dimensions so each result can be
classified before editing. Use --strict in CI after the project allowlist is
curated.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


STYLE_DECLARATION = re.compile(r"^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:\s*\{")
DIMENSION = re.compile(r"\b(minHeight|height|width|minWidth)\s*:\s*([0-9]+)")

BUTTON_HINTS = re.compile(
    r"(?:button|btn|action|submit|primary|secondary|danger|destructive|confirm|complete|"
    r"upload|retry|remove|delete|close|back|refresh|save|continue|checkout|ack)",
    re.IGNORECASE,
)
NON_BUTTON_HINTS = re.compile(
    r"(?:input|wrap|row|card|iconwrap|avatar|thumb|badge|pill|chip|segment|suggest|"
    r"option|picker|header|footer|modal|content|image|photo|media|text|label|title|"
    r"divider|separator|list|item|container|overlay|dot|badge)",
    re.IGNORECASE,
)

ALLOWED_VISUAL_DIMENSIONS = {36, 44}
SOURCE_EXTENSIONS = {".tsx", ".ts"}

# Each tuple is an existing, source-specific exception observed in the clean
# baseline. The audit remains strict for every other path/style/property/value
# combination, so new hard-coded dimensions cannot be hidden by this list.
# These entries are documented legacy UI debt, not proof of a 44pt touch target;
# a passing --strict result means only that no *new unlisted* dimension was
# found. Verify the affected screen on device before changing a listed control,
# then remove the exception when the control is migrated to shared primitives.
KNOWN_LEGACY_EXCEPTIONS = {
    ("src/screens/tasks/CleaningSelfCompleteScreen.tsx", "roomConfirmButton", "minWidth", 0),
    ("src/components/GuestLuggageCard.tsx", "ackDone", "minHeight", 38),
    ("src/screens/ForgotPasswordScreen.tsx", "submitBtn", "minHeight", 48),
    ("src/screens/me/AccountScreen.tsx", "btn", "minHeight", 48),
    ("src/screens/me/ChangePasswordScreen.tsx", "eyeBtn", "width", 34),
    ("src/screens/me/ChangePasswordScreen.tsx", "btn", "minHeight", 46),
    ("src/screens/tabs/ContactsScreen.tsx", "callBtn", "width", 36),
    ("src/screens/tabs/TasksScreen.tsx", "tagDanger", "minHeight", 24),
    ("src/screens/tasks/CleaningSelfCompleteScreen.tsx", "removeBtn", "width", 22),
    ("src/screens/tasks/DayEndBackupKeysScreen.tsx", "removeBtn", "height", 28),
    ("src/screens/tasks/FeedbackFormScreen.tsx", "thumbDeleteBtn", "width", 20),
    ("src/screens/tasks/FeedbackFormScreen.tsx", "feedbackMain", "minWidth", 0),
    ("src/screens/tasks/FeedbackFormScreen.tsx", "feedbackThumbBadge", "minWidth", 18),
    ("src/screens/tasks/InspectionPanelScreen.tsx", "roomConfirmButton", "minWidth", 0),
    ("src/screens/tasks/InspectionPanelScreen.tsx", "bottomSecondaryButton", "minWidth", 0),
    ("src/screens/tasks/InspectionPanelScreen.tsx", "restockActionCol", "minWidth", 0),
    ("src/screens/tasks/InspectionPanelScreen.tsx", "proofDeleteBtn", "width", 24),
    ("src/screens/tasks/ManagerDailyTaskScreen.tsx", "luggageRemovePhoto", "width", 26),
    ("src/screens/tasks/SuppliesFormScreen.tsx", "thumbDeleteBtn", "width", 18),
    ("src/screens/tasks/TaskDetailScreen.tsx", "tagDanger", "height", 24),
    ("src/screens/tasks/TaskDetailScreen.tsx", "actionBtnEqualWidth", "minWidth", 0),
    ("src/screens/tasks/TaskDetailScreen.tsx", "markPhotoRemoveVisual", "width", 40),
}


def find_mobile_root(start: Path) -> Path:
    candidates = [start, start / "mz-cleaning-app-frontend"]
    for candidate in candidates:
        if (candidate / "src").is_dir() and (candidate / "package.json").is_file():
            return candidate
    raise SystemExit("Could not locate mz-cleaning-app-frontend from the current directory")


def record_dimension(
    findings: list[tuple[Path, int, str, str, int]],
    path: Path,
    line_number: int,
    style_name: str,
    match: re.Match[str],
) -> None:
    dimension_name, value_text = match.groups()
    value = int(value_text)
    source_root = next(parent for parent in path.parents if parent.name == "src")
    relative_path = path.relative_to(source_root.parent).as_posix()
    if (relative_path, style_name, dimension_name, value) in KNOWN_LEGACY_EXCEPTIONS:
        return
    if not BUTTON_HINTS.search(style_name):
        return
    if NON_BUTTON_HINTS.search(style_name) and not re.search(
        r"(?:button|btn|action|submit|primary|secondary|danger|confirm|complete|upload|retry|remove|delete|close|back|refresh|save|continue|checkout|ack)",
        style_name,
        re.IGNORECASE,
    ):
        return

    if dimension_name in {"height", "minHeight"} and value not in ALLOWED_VISUAL_DIMENSIONS:
        reason = f"{dimension_name}={value}; review semantic class and use a shared token or documented exception"
        findings.append((path, line_number, style_name, reason, value))
    elif dimension_name in {"width", "minWidth"} and value < 44:
        reason = f"{dimension_name}={value}; icon/action touch frame may be smaller than 44"
        findings.append((path, line_number, style_name, reason, value))


def scan_file(path: Path) -> list[tuple[Path, int, str, str, int]]:
    findings: list[tuple[Path, int, str, str, int]] = []
    lines = path.read_text(encoding="utf-8").splitlines()
    current_style: str | None = None
    style_indent: int | None = None

    for line_number, line in enumerate(lines, start=1):
        declaration = STYLE_DECLARATION.match(line)
        if declaration:
            current_style = declaration.group(1)
            style_indent = len(line) - len(line.lstrip())
            inline_dimension = DIMENSION.search(line)
            if inline_dimension:
                record_dimension(findings, path, line_number, current_style, inline_dimension)
            if line.count("{") <= line.count("}"):
                current_style = None
                style_indent = None
            continue

        if current_style and style_indent is not None:
            stripped = line.strip()
            indent = len(line) - len(line.lstrip())
            if stripped and indent <= style_indent and not stripped.startswith("//"):
                current_style = None
                style_indent = None
                continue

            match = DIMENSION.search(line)
            if not match:
                continue
            record_dimension(findings, path, line_number, current_style, match)

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, help="Mobile repo root; defaults to the current workspace")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 for unlisted findings; documented legacy exceptions remain debt",
    )
    args = parser.parse_args()

    mobile_root = find_mobile_root((args.root or Path.cwd()).resolve())
    findings: list[tuple[Path, int, str, str, int]] = []
    for path in sorted((mobile_root / "src").rglob("*")):
        if path.suffix in SOURCE_EXTENSIONS and path.is_file():
            findings.extend(scan_file(path))

    if not findings:
        print("button-contract: no suspicious hard-coded button dimensions found")
        print(
            f"button-contract: {len(KNOWN_LEGACY_EXCEPTIONS)} documented legacy exception(s) "
            "were excluded; this is not a complete 44pt conformance result"
        )
        return 0

    print("button-contract: review these semantic-looking dimensions before changing them:")
    for path, line_number, style_name, reason, _value in findings:
        relative_path = path.relative_to(mobile_root)
        print(f"- {relative_path}:{line_number} {style_name}: {reason}")
    print(f"button-contract: {len(findings)} finding(s); classify each as button, exception, or non-button")
    return 1 if args.strict else 0


if __name__ == "__main__":
    sys.exit(main())
