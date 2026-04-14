/**
 * Announcement Bar — red banner above header
 * [AV-037] new: v5.2.0 UI overhaul
 * To remove: delete this file, remove from layout.js
 */
export default function AnnouncementBar() {
  return (
    <div className="bg-av-red text-av-bone text-center py-2.5 px-5
                    font-heading text-[13px] tracking-[3px] uppercase">
      Free Shipping on Orders Over $75 — Use Code: <span className="font-bold">FREEDOM15</span>
    </div>
  );
}
