import { GraduationCap, Phone, Mail, MapPin, Instagram, Youtube, Linkedin, Facebook } from "lucide-react";
import { Link } from "react-router-dom";
import { ADMIN_LOGIN_PATH } from "@/lib/authRoutes";

export const SiteFooter = () => (
  <footer id="footer" className="border-t border-slate-800 bg-slate-950 text-slate-400">
    <div className="container mx-auto px-6 py-16">
      <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-lg overflow-hidden bg-white">
              <img src="/logo.png" alt="EzyIntern" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-bold text-2xl tracking-tighter text-white"><span className="text-[#5ea4e8]">Ezy</span><span>intern</span></div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Internship Provider</div>
            </div>
          </div>
          <p className="text-sm leading-relaxed">
            Bihar's trusted platform for UGC-compliant internship programmes, digital certification, and academic credit tracking.
          </p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-primary transition-colors"><Instagram className="size-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Youtube className="size-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Linkedin className="size-5" /></a>
            <a href="#" className="hover:text-primary transition-colors"><Facebook className="size-5" /></a>
          </div>
        </div>

        <div>
          <h4 className="font-black text-sm uppercase tracking-widest text-white mb-6">Quick Links</h4>
          <ul className="space-y-4 text-sm">
            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><a href="/#why" className="hover:text-white transition-colors">Why Join</a></li>
            <li><a href="/#faq" className="hover:text-white transition-colors">FAQ</a></li>
            <li><Link to="/verify" className="hover:text-white transition-colors">Verify Certificate</Link></li>
            <li><Link to="/cybercafe" className="hover:text-white transition-colors font-semibold text-[#5ea4e8]">Cyber Cafe Partner</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-black text-sm uppercase tracking-widest text-white mb-6">For Students</h4>
          <ul className="space-y-4 text-sm">
            <li><Link to="/register" className="hover:text-white transition-colors font-bold text-primary">Register Now</Link></li>
            <li><Link to="/login" className="hover:text-white transition-colors">Student Login</Link></li>
            <li><Link to={ADMIN_LOGIN_PATH} className="hover:text-white transition-colors">Admin and staff login</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">Help & Support</Link></li>
            <li><Link to="/benefits" className="hover:text-white transition-colors">Program Benefits</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-black text-sm uppercase tracking-widest text-white mb-6">Contact Us</h4>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="size-5 mt-0.5 text-primary flex-shrink-0" />
              <span>Arfabad Colony, East Nahar Road, <br/>Bajrangpuri, Patna - 800007, Bihar</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="size-5 text-primary flex-shrink-0" />
              <div className="flex flex-col">
                <a href="tel:+917050936593" className="hover:text-white">+91 70509 36593</a>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="size-5 text-primary flex-shrink-0" />
              <div className="flex flex-col">
                <a href="mailto:contact@ezyintern.in" className="hover:text-white">contact@ezyintern.in</a>
                <a href="mailto:support@ezyintern.in" className="hover:text-white">support@ezyintern.in</a>
              </div>
            </li>
          </ul>
        </div>
      </div>


      <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <p>© {new Date().getFullYear()} EzyIntern. Government Certified Provider.</p>
        <div className="flex gap-8">
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white">Terms of Service</Link>
        </div>
      </div>
    </div>
  </footer>
);
