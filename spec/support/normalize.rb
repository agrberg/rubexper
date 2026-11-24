# frozen_string_literal: true

require 'regexp_parser'

module Normalize
  SYNTAX = 'ruby/3.4'
  QUANTIFIER_MODES = { greedy: 'greedy', reluctant: 'lazy', possessive: 'possessive' }.freeze

  module_function

  def parse(source, flags = '')
    options = 0
    options |= Regexp::EXTENDED if flags.include?('x')
    options |= Regexp::IGNORECASE if flags.include?('i')
    options |= Regexp::MULTILINE if flags.include?('m')
    node(Regexp::Parser.parse(source, SYNTAX, options: options))
  end

  def node(exp)
    kids = children(exp)
    case exp.type
    when :expression then { 'k' => 'seq', 'c' => kids }
    when :group then group(exp, kids)
    when :assertion then { 'k' => 'group', 't' => exp.token.to_s, 's' => exp.text, 'c' => kids }
    when :set then { 'k' => 'set', 't' => exp.token.to_s, 'neg' => exp.respond_to?(:negative?) && exp.negative?, 'c' => kids }
    when :meta then meta(exp, kids)
    when :conditional then conditional(exp, kids)
    else leaf(exp)
    end
  end

# regexp_parser files (?#...) as a group and drops the closing paren from an option switch such as (?i).
def group(exp, kids)
  return { 'k' => 'comment', 's' => exp.text } if exp.token == :comment

  text = exp.token == :options_switch ? "#{exp.text})" : exp.text
  { 'k' => 'group', 't' => exp.token.to_s, 's' => text, 'c' => kids }
end

def conditional(exp, kids)
    return { 'k' => 'cond', 't' => 'condition', 's' => exp.text, 'c' => [] } if exp.token == :condition

    { 'k' => 'cond', 't' => exp.token.to_s, 'c' => kids }
  end

  def children(exp)
    return [] unless exp.respond_to?(:expressions)

    exp.expressions.flat_map { |child| wrap(child) }
  end

  # One quantifier wraps the one atom it follows; merged literals are split per character.
  def wrap(exp)
    return free_space(exp) if exp.type == :free_space

    if exp.type == :literal && exp.text.length > 1
      chars = exp.text.chars.map { |c| { 'k' => 'lit', 's' => c } }
      chars[-1] = quantify(exp, chars[-1])
      return chars
    end
    [quantify(exp, node(exp))]
  end

def free_space(exp)
  return [] unless exp.token == :comment

  [{ 'k' => 'comment', 's' => exp.text.chomp }]
end

def quantify(exp, atom)
    q = exp.quantifier
    return atom unless q

    { 'k' => 'q', 'min' => q.min, 'max' => q.max == -1 ? nil : q.max,
      'mode' => QUANTIFIER_MODES.fetch(q.mode), 'c' => [atom] }
  end

  def meta(exp, kids)
    case exp.token
    when :alternation then { 'k' => 'alt', 'c' => kids }
    when :dot then { 'k' => 'cls', 's' => '.' }
    else raise "unmapped meta #{exp.token}"
    end
  end

  def leaf(exp)
    kind = {
      literal: 'lit', escape: 'esc', type: 'cls', anchor: 'anchor', keep: 'anchor',
      posixclass: 'posix', nonposixclass: 'posix', property: 'prop', nonproperty: 'prop',
      backref: 'ref', comment: 'comment', conditional: 'cond', set: 'set'
    }.fetch(exp.type) { raise "unmapped #{exp.type}/#{exp.token}" }
    kind = 'call' if exp.type == :backref && exp.token.to_s.end_with?('_call')
    { 'k' => kind, 's' => exp.text }
  end
end
