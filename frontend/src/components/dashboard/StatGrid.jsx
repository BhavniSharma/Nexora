import Icon from "../common/Icon";

export default function StatGrid({ cards }) {
  return (
    <section className="stat-grid" id="overview">
      {cards.map((card) => (
        <article className="stat-card" key={card.id}>
          <div className="stat-icon">
            <Icon name={card.icon} size={26} />
          </div>
          <div className="stat-body">
            <span className="stat-label">{card.label}</span>
            <strong className="stat-value">{card.value}</strong>
            <small className="stat-foot">{card.foot}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
