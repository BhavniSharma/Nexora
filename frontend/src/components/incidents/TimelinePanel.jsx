import { useState } from "react";
import Icon from "../common/Icon";
import { formatTimelineTime } from "../../utils/helpers";

export default function TimelinePanel({
  history,
  timelineHistory,
  timelineLoading,
  timelineErrors,
  onFetchTimeline,
}) {
  const [showAll, setShowAll] = useState(false);
  const displayHistory = showAll ? history : history.slice(0, 3);

  return (
    <section className="panel timeline-panel" id="timeline">
      <div className="panel-heading">
        <span className="panel-icon"><Icon name="activity" size={20} /></span>
        <div>
          <h2>Incident Timeline</h2>
          <p>
            Recorded detection, diagnosis, remediation audit, and
            recovery events from incident history.
          </p>
        </div>
        <button
          className="view-all"
          onClick={() => setShowAll(!showAll)}
          aria-label={showAll ? "Show fewer incidents" : "View all incidents"}
        >
          {showAll ? "Show Less" : "View All"} <Icon name="arrow" size={14} />
        </button>
      </div>

      <div className="timeline-list">
        {displayHistory.length === 0 ? (
          <p>No timeline events available yet.</p>
        ) : (
          displayHistory.map((incident) => {
            const events = timelineHistory[incident.id];

            return (
              <div className="timeline-item" key={incident.id}>
                <div
                  className={`timeline-marker ${
                    incident.status === "RESOLVED" ? "resolved" : "open"
                  }`}
                />

                <div className="timeline-content">
                  <div className="timeline-item-heading">
                    <strong>
                      Incident #{incident.id} — {incident.metric}
                    </strong>

                    <span
                      className={`timeline-status ${
                        incident.status === "RESOLVED" ? "resolved" : "open"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>

                  <p>{incident.message}</p>

                  <p className="timeline-time">
                    <strong>Detected:</strong> {formatTimelineTime(incident.created_at)}
                  </p>

                  {incident.resolved_at && (
                    <p className="timeline-time">
                      <strong>Resolved:</strong> {formatTimelineTime(incident.resolved_at)}
                    </p>
                  )}

                  <p className="timeline-time">
                    <strong>Recorded value:</strong> {incident.value}% ·{" "}
                    <strong>Threshold:</strong> {incident.threshold}%
                  </p>

                  <div className="timeline-events">
                    <h4>Recorded Events</h4>

                    {timelineLoading[incident.id] ? (
                      <p>Loading incident events…</p>
                    ) : timelineErrors[incident.id] ? (
                      <div>
                        <p className="error">{timelineErrors[incident.id]}</p>
                        <button onClick={() => onFetchTimeline(incident.id)}>
                          Retry timeline
                        </button>
                      </div>
                    ) : !events ? (
                      <button onClick={() => onFetchTimeline(incident.id)}>
                        Load timeline events
                      </button>
                    ) : events.length === 0 ? (
                      <p>No detailed events recorded for this incident.</p>
                    ) : (
                      <ol className="timeline-event-list">
                        {events.map((event, index) => {
                          const details = event.details || {};

                          return (
                            <li key={`${incident.id}-${event.event_type || "event"}-${index}`}>
                              <div className="timeline-event-heading">
                                <strong className="timeline-event-title">
                                  {event.title || event.event_type || "Incident event"}
                                </strong>

                                <span className="timeline-event-timestamp">
                                  {formatTimelineTime(event.timestamp)}
                                </span>
                              </div>

                              {details.message && <p>{details.message}</p>}

                              {details.metric && (
                                <p className="timeline-time">
                                  <strong>Metric:</strong> {details.metric}
                                </p>
                              )}

                              {details.value !== undefined && (
                                <p className="timeline-time">
                                  <strong>Value:</strong> {details.value}%
                                </p>
                              )}

                              {details.threshold !== undefined && (
                                <p className="timeline-time">
                                  <strong>Threshold:</strong> {details.threshold}%
                                </p>
                              )}

                              {details.severity && (
                                <p className="timeline-time">
                                  <strong>Severity:</strong> {details.severity}
                                </p>
                              )}

                              {details.snapshot_id !== undefined && (
                                <p className="timeline-time">
                                  <strong>Snapshot ID:</strong> {details.snapshot_id}
                                </p>
                              )}

                              {details.capture_reason && (
                                <p className="timeline-time">
                                  <strong>Capture reason:</strong>{" "}
                                  {details.capture_reason.replace(/_/g, " ")}
                                </p>
                              )}

                              {details.collection_status && (
                                <p className="timeline-time">
                                  <strong>Collection status:</strong>{" "}
                                  {details.collection_status}
                                </p>
                              )}

                              {details.action && (
                                <p className="timeline-time">
                                  <strong>Action:</strong> {details.action}
                                </p>
                              )}

                              {details.mode && (
                                <p className="timeline-time">
                                  <strong>Mode:</strong> {details.mode}
                                </p>
                              )}

                              {details.executed !== undefined && (
                                <p className="timeline-time">
                                  <strong>Executed:</strong>{" "}
                                  {details.executed ? "Yes" : "No"}
                                </p>
                              )}

                              {details.result && (
                                <p className="timeline-time">
                                  <strong>Result:</strong> {details.result}
                                </p>
                              )}

                              {details.audit_id !== undefined && (
                                <p className="timeline-time">
                                  <strong>Audit ID:</strong> {details.audit_id}
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!showAll && history.length > 3 && (
        <p className="empty-copy" style={{ textAlign: "center", marginTop: 10 }}>
          {history.length - 3} more incident(s) in storage. Click "View All" to see them.
        </p>
      )}
    </section>
  );
}
