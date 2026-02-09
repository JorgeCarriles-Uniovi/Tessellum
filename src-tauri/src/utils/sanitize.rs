/// Sanitizes a given string by filtering out any characters that are not alphanumeric
/// or one of the following allowed special characters: space (' '), hyphen ('-'),
/// underscore ('_'), parentheses, or period.
///
/// # Parameters
/// - `s`: A `String` input containing the text to be sanitized.
///
/// # Returns
/// A new `String` containing only the allowed characters from the input.
pub fn sanitize_string(s: String) -> String {
    let sanitized: String = s
        .chars()
        .filter(|c| {
            c.is_alphanumeric()
                || *c == ' '
                || *c == '-'
                || *c == '_'
                || *c == '('
                || *c == ')'
                || *c == '.'
        })
        .collect();
    sanitized
        .trim_end_matches(|c| c == '.' || c == ' ')
        .to_string()
}
