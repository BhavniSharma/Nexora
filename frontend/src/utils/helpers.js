export const toSeries = (points) =>
  (points || [])
    .slice(-30)
    .map((point, index) => {
      const time = point.timestamp ? new Date(point.timestamp).getTime() : NaN;
      return {
        t: Number.isNaN(time) ? index : time,
        v: Number(point.value),
      };
    })
    .filter((point) => Number.isFinite(point.v));

export const timeAgo = (timestamp) => {
  if (!timestamp) return "—";
  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export const priorityOf = (severity = "") => {
  if (/crit|high/i.test(severity)) return { label: "High", tone: "red" };
  if (/med|warn/i.test(severity)) return { label: "Medium", tone: "amber" };
  return { label: "Low", tone: "grey" };
};

export const formatTimelineTime = (timestamp) => {
  if (!timestamp) return "Time not recorded";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Invalid timestamp";
  return date.toLocaleString();
};
