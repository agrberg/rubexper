# frozen_string_literal: true

require 'json'
require 'open3'
require_relative 'support/normalize'

RSpec.describe 'TypeScript parser conformance' do
  def self.lines(name)
    File.readlines(File.join(__dir__, name), chomp: true).reject(&:empty?)
  end

  def self.run_cli(cases)
    out, err, status = Open3.capture3('node', 'bin/rubexper-ast.ts', stdin_data: JSON.generate(cases))
    raise "CLI failed: #{err}" unless status.success?

    JSON.parse(out)
  end

  valid = lines('corpus.txt').map { |s| [s, ''] } + lines('corpus_x.txt').map { |s| [s, 'x'] }
  invalid = lines('invalid.txt')

  results = nil
  invalid_results = nil
  before(:context) do
    results = self.class.run_cli(valid.map { |source, flags| { 'source' => source, 'flags' => flags } })
    invalid_results = self.class.run_cli(invalid.map { |source| { 'source' => source, 'flags' => '' } })
  end

  valid.each_with_index do |(source, flags), index|
    it "parses #{source.inspect} (flags #{flags.inspect}) like regexp_parser" do
      Regexp.new(source, flags.include?('x') ? Regexp::EXTENDED : 0) # the corpus itself must be valid Ruby
      expect(results[index]).to eq({ 'ok' => true, 'ast' => Normalize.parse(source, flags) })
    end
  end

  invalid.each_with_index do |source, index|
    it "rejects #{source.inspect}" do
      expect { Regexp.new(source) }.to raise_error(RegexpError)
      expect(invalid_results[index]['ok']).to be(false)
    end
  end
end
