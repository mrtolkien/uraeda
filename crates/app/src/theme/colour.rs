//! Colours as the tokens write them, and the one way two of them are mixed: in sRGB, channel by
//! channel, as CSS's `color-mix` does.

/// A colour's red, green, and blue, from 0 to 255, and its alpha, from 0 to 1.
pub type Rgba = [f64; 4];

/// `colour` read: `#rrggbb`, `#rrggbbaa`, or `rgba(r, g, b, a)`, as [`fade`] writes it.
pub fn parse(colour: &str) -> Option<Rgba> {
    if let Some(hex) = colour.strip_prefix('#') {
        let channel = |at: usize| {
            let byte = u8::from_str_radix(hex.get(at..at + 2)?, 16).ok()?;
            Some(f64::from(byte))
        };
        let alpha = match hex.len() {
            6 => 1.0,
            8 => channel(6)? / 255.0,
            _ => return None,
        };
        return Some([channel(0)?, channel(2)?, channel(4)?, alpha]);
    }
    let inside = colour.strip_prefix("rgba(")?.strip_suffix(')')?;
    let mut parts = inside.split(',').map(|part| part.trim().parse::<f64>());
    let mut next = || parts.next()?.ok();
    Some([next()?, next()?, next()?, next()?])
}

/// A channel as two hex digits.
fn byte(channel: f64) -> String {
    format!("{:02x}", channel.round().clamp(0.0, 255.0) as u8)
}

/// An opaque colour, `#rrggbb`.
pub fn hex([r, g, b, _]: Rgba) -> String {
    format!("#{}{}{}", byte(r), byte(g), byte(b))
}

/// `share` of `a`, the rest of `b`, as `#rrggbb`: their alphas are not counted.
pub fn mix(a: &str, b: &str, share: f64) -> Option<String> {
    let (x, y) = (parse(a)?, parse(b)?);
    let part = |i: usize| x[i].mul_add(share, y[i] * (1.0 - share));
    Some(hex([part(0), part(1), part(2), 1.0]))
}

/// `colour` at `opacity` of its own, as `rgba(r, g, b, a)`.
pub fn fade(colour: &str, opacity: f64) -> Option<String> {
    let [r, g, b, alpha] = parse(colour)?;
    Some(format!("rgba({r}, {g}, {b}, {})", opacity * alpha))
}

/// `colour` laid over `under`, itself taken as opaque, as `#rrggbb`.
pub fn over(colour: &str, under: &str) -> Option<String> {
    let [r, g, b, alpha] = parse(colour)?;
    let [ur, ug, ub, _] = parse(under)?;
    let lay = |top: f64, bottom: f64| top.mul_add(alpha, bottom * (1.0 - alpha));
    Some(hex([lay(r, ur), lay(g, ug), lay(b, ub), 1.0]))
}

/// `colour` without its alpha, as `#rrggbb`.
pub fn solid(colour: &str) -> Option<String> {
    parse(colour).map(hex)
}

/// A channel, from 0 to 255, without its gamma.
fn linear(channel: f64) -> f64 {
    let channel = channel / 255.0;
    if channel <= 0.040_45 {
        channel / 12.92
    } else {
        ((channel + 0.055) / 1.055).powf(2.4)
    }
}

/// The contrast ratio of `front` on `back`, from 1 to 21, as WCAG 2.x measures it: `front` is laid
/// over `back` first when it has alpha, and `back` is taken as opaque.
pub fn contrast(front: &str, back: &str) -> Option<f64> {
    let luminance = |colour: &str| {
        let [r, g, b, _] = parse(colour)?;
        Some(0.2126f64.mul_add(linear(r), 0.7152f64.mul_add(linear(g), 0.0722 * linear(b))))
    };
    let (front, back) = (luminance(&over(front, back)?)?, luminance(back)?);
    Some((front.max(back) + 0.05) / (front.min(back) + 0.05))
}
