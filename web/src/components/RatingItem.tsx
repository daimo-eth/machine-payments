import type { Rating } from "../types";
import { StarRating } from "./StarRating";
import { TagChip } from "./TagChip";

export function RatingItem({ rating }: { rating: Rating }) {
  const tags = rating.tags ?? [];
  const date = new Date(rating.created_at).toLocaleDateString();

  return (
    <div className="rating-item">
      <div className="rating-item-header">
        <StarRating score={rating.score} />
        <span className="rating-date">{date}</span>
      </div>
      {rating.comment && <p className="rating-comment">{rating.comment}</p>}
      {tags.length > 0 && (
        <div className="rating-tags">
          {tags.map((t) => <TagChip key={t} tag={t} />)}
        </div>
      )}
    </div>
  );
}
