import { parseDate, localDate, words } from "./core.js";

export function budgetTotals(expenses) {
  return expenses
    .filter((x) => !x.archived)
    .reduce(
      (sum, x) => {
        const amount = Number(x.amount) || 0;
        sum.total += amount;
        sum[
          x.status === "Paid"
            ? "paid"
            : x.status === "Waived"
              ? "waived"
              : "planned"
        ] += amount;
        return sum;
      },
      { total: 0, paid: 0, waived: 0, planned: 0 },
    );
}

export function backwardPlan(deadline, name) {
  const date = parseDate(deadline);
  if (!date || Number.isNaN(date.getTime()))
    throw new Error("Set a valid application deadline first.");
  return [
    [42, "Outline essays"],
    [28, "Finish the first essay draft"],
    [21, "Request feedback on essays"],
    [14, "Check recommendations and documents"],
    [7, "Review application details"],
    [2, "Submit and save confirmation"],
  ].map(([offset, title]) => {
    const d = new Date(date);
    d.setDate(d.getDate() - offset);
    return { title: `${name}: ${title}`, due: localDate(d), offset };
  });
}

export function essayInsights(body, limit) {
  const text = String(body || "").trim();
  const count = words(text);
  const sentences = text
    ? text.split(/[.!?]+(?:\s|$)/u).filter((x) => x.trim()).length
    : 0;
  const stop = new Set(
    "about after again also because been before being could every from have into just more most much only other over really some than that their them then there these they this those through very were what when where which while will with would your yourself".split(
      " ",
    ),
  );
  const counts = new Map();
  for (const word of text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [])
    if (word.length > 3 && !stop.has(word))
      counts.set(word, (counts.get(word) || 0) + 1);
  return {
    count,
    characters: String(body || "").length,
    paragraphs: text ? text.split(/\n\s*\n/).length : 0,
    sentences,
    readingMinutes: count ? Math.max(1, Math.ceil(count / 200)) : 0,
    remaining: limit ? Number(limit) - count : null,
    repeated: [...counts]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
  };
}
