import re
from dataclasses import dataclass, field

OPS_RULE_VERSION = "ops-v1.0.0"

URL_PATTERN = re.compile(r"https?://\S+")
REPEAT_CHAR_PATTERN = re.compile(r"([ㅋㅎㅠㅜ!.?])\1{9,}")
EMOJI_PATTERN = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F02F]"
)


@dataclass
class OpsSignal:
    comment_id: str
    rule_version: str
    spam_flags: list[str] = field(default_factory=list)
    repetition_count: int = 0
    url_ratio: float = 0.0
    ops_score: float = 0.0
    labels: list[str] = field(default_factory=list)
    classification: str = "reference_only"


_WEIGHTS = {
    "spam.repetition": 0.3,
    "spam.promotion": 0.2,
    "noise.low_semantic_density": 0.1,
    "bot.like_pattern": 0.25,
    "coordinated.attack": 0.35,
}


def calculate_ops_score(flags: list[str]) -> float:
    return min(sum(_WEIGHTS.get(f, 0) for f in flags), 1.0)


def run_ops_rules(comment: dict, account_pattern: dict | None, duplicate_count: int) -> OpsSignal:
    text = comment["text"]
    flags: list[str] = []

    if duplicate_count >= 3:
        flags.append("spam.repetition")

    tokens = text.split()
    urls = URL_PATTERN.findall(text)
    url_ratio = len(urls) / max(len(tokens), 1)
    if url_ratio >= 0.3:
        flags.append("spam.promotion")

    emoji_count = len(EMOJI_PATTERN.findall(text))
    if (
        REPEAT_CHAR_PATTERN.search(text)
        or (len(text) > 0 and emoji_count / len(text) >= 0.7)
        or len(tokens) <= 3
    ):
        flags.append("noise.low_semantic_density")

    if account_pattern:
        if account_pattern.get("is_new_account") and account_pattern.get("comment_count_30d", 0) >= 50:
            flags.append("bot.like_pattern")
        if account_pattern.get("repeat_attack_flag"):
            flags.append("coordinated.attack")

    return OpsSignal(
        comment_id=comment["id"],
        rule_version=OPS_RULE_VERSION,
        spam_flags=flags,
        repetition_count=duplicate_count,
        url_ratio=round(url_ratio, 3),
        ops_score=calculate_ops_score(flags),
        labels=flags,
    )
