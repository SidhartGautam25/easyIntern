import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const VisitorTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Get or create a unique visitor ID
        let visitorId = localStorage.getItem("ezy_visitor_id");
        if (!visitorId) {
          visitorId = crypto.randomUUID();
          localStorage.setItem("ezy_visitor_id", visitorId);
        }

        // Log the visit
        await supabase.from("site_visits").insert({
          visitor_id: visitorId,
          page_path: location.pathname,
          referrer: document.referrer,
          user_agent: navigator.userAgent,
        });
      } catch (err) {
        console.error("Tracking error:", err);
      }
    };

    trackVisit();
  }, [location.pathname]);

  return null;
};
