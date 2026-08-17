// wa-type <pid> <tekst|--enter>
// Stuurt unicode-toetsaanslagen (of Enter) rechtstreeks naar het opgegeven proces via
// CGEventPostToPid, zodat WhatsApp berichten kan ontvangen zonder dat de app frontmost
// hoeft te zijn en zonder muis/focus/klembord van de gebruiker aan te raken.
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

int main(int argc, char *argv[]) {
    @autoreleasepool {
        if (argc < 3) { fprintf(stderr, "gebruik: wa-type <pid> <tekst|--enter>\n"); return 1; }
        pid_t pid = (pid_t)atoi(argv[1]);
        NSString *tekst = [NSString stringWithUTF8String:argv[2]];
        if ([tekst isEqualToString:@"--keycode"] && argc >= 4) {
            // losse toets (evt. met cmd) naar het proces, bijv. --keycode 3 cmd = Cmd+F
            CGKeyCode kc = (CGKeyCode)atoi(argv[3]);
            bool metCmd = (argc >= 5 && strcmp(argv[4], "cmd") == 0);
            CGEventRef d = CGEventCreateKeyboardEvent(NULL, kc, true);
            CGEventRef u = CGEventCreateKeyboardEvent(NULL, kc, false);
            if (metCmd) { CGEventSetFlags(d, kCGEventFlagMaskCommand); CGEventSetFlags(u, kCGEventFlagMaskCommand); }
            CGEventPostToPid(pid, d); usleep(60000); CGEventPostToPid(pid, u);
            CFRelease(d); CFRelease(u);
            return 0;
        }
        if ([tekst isEqualToString:@"--klik"] && argc >= 5) {
            // muisklik naar het proces sturen zonder de echte cursor te bewegen
            CGPoint pt = CGPointMake(atof(argv[3]), atof(argv[4]));
            CGEventRef mv = CGEventCreateMouseEvent(NULL, kCGEventMouseMoved, pt, kCGMouseButtonLeft);
            CGEventRef dn = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseDown, pt, kCGMouseButtonLeft);
            CGEventRef up = CGEventCreateMouseEvent(NULL, kCGEventLeftMouseUp, pt, kCGMouseButtonLeft);
            CGEventPostToPid(pid, mv); usleep(60000);
            CGEventPostToPid(pid, dn); usleep(80000);
            CGEventPostToPid(pid, up);
            CFRelease(mv); CFRelease(dn); CFRelease(up);
            return 0;
        }
        if ([tekst isEqualToString:@"--wis"]) {
            // Cmd+A gevolgd door delete: maakt het berichtvak echt leeg (ook interne staat)
            CGEventRef ad = CGEventCreateKeyboardEvent(NULL, 0, true);
            CGEventRef au = CGEventCreateKeyboardEvent(NULL, 0, false);
            CGEventSetFlags(ad, kCGEventFlagMaskCommand);
            CGEventSetFlags(au, kCGEventFlagMaskCommand);
            CGEventPostToPid(pid, ad); usleep(50000); CGEventPostToPid(pid, au); usleep(80000);
            CGEventRef dd = CGEventCreateKeyboardEvent(NULL, 51, true);
            CGEventRef du = CGEventCreateKeyboardEvent(NULL, 51, false);
            CGEventPostToPid(pid, dd); usleep(50000); CGEventPostToPid(pid, du);
            CFRelease(ad); CFRelease(au); CFRelease(dd); CFRelease(du);
            return 0;
        }
        if ([tekst isEqualToString:@"--enter"]) {
            CGEventRef d = CGEventCreateKeyboardEvent(NULL, 36, true);
            CGEventRef u = CGEventCreateKeyboardEvent(NULL, 36, false);
            CGEventPostToPid(pid, d); usleep(50000); CGEventPostToPid(pid, u);
            CFRelease(d); CFRelease(u);
            return 0;
        }
        NSUInteger len = tekst.length;
        for (NSUInteger i = 0; i < len; i += 16) {
            NSRange r = NSMakeRange(i, MIN((NSUInteger)16, len - i));
            unichar buf[16];
            [tekst getCharacters:buf range:r];
            CGEventRef d = CGEventCreateKeyboardEvent(NULL, 0, true);
            CGEventKeyboardSetUnicodeString(d, r.length, buf);
            CGEventPostToPid(pid, d);
            usleep(30000);
            CGEventRef u = CGEventCreateKeyboardEvent(NULL, 0, false);
            CGEventKeyboardSetUnicodeString(u, r.length, buf);
            CGEventPostToPid(pid, u);
            usleep(30000);
            CFRelease(d); CFRelease(u);
        }
        return 0;
    }
}
