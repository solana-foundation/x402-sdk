# frozen_string_literal: true

if ENV["X402_RUBY_COVERAGE"] == "1"
  require "coverage"
  require "fileutils"
  require "json"

  Coverage.start(lines: true)

  at_exit do
    root = File.expand_path("..", __dir__)
    lib_root = File.join(root, "lib")
    files = {}
    total_lines = 0
    covered_lines = 0

    Coverage.result.each do |path, data|
      next unless path.start_with?(lib_root)

      line_hits = data.is_a?(Hash) ? data.fetch(:lines) : data
      executable = line_hits.compact
      file_total = executable.length
      file_covered = executable.count(&:positive?)
      next if file_total.zero?

      total_lines += file_total
      covered_lines += file_covered
      files[path.delete_prefix("#{root}/")] = {
        "covered_lines" => file_covered,
        "total_lines" => file_total,
        "line_percent" => ((file_covered.to_f / file_total) * 100).round(2)
      }
    end

    report = {
      "covered_lines" => covered_lines,
      "total_lines" => total_lines,
      "line_percent" => total_lines.zero? ? 100.0 : ((covered_lines.to_f / total_lines) * 100).round(2),
      "files" => files
    }
    coverage_dir = File.join(root, "coverage")
    FileUtils.mkdir_p(coverage_dir)
    File.write(File.join(coverage_dir, "coverage.json"), JSON.pretty_generate(report))
  end
end

require "minitest/autorun"
